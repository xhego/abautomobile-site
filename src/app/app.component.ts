import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { StoredGalleryImage, SupabaseSiteService } from './supabase-site.service';

interface GalleryImage {
  id?: string;
  srcImg: string;
  title: string;
  storagePath?: string;
  sortOrder?: number;
}

interface ServiceItem {
  icon: string;
  title: string;
  description: string;
}

type AdminPanel = 'images' | 'info' | 'workshop';
type SitePage = 'home' | 'gallery' | 'signin';
type WorkshopPage =
  'dashboard' |
  'calendar' |
  'bookings' |
  'board' |
  'job-cards' |
  'estimates' |
  'payments' |
  'mechanics' |
  'settings';

interface WorkshopJob {
  id: string;
  customerName: string;
  customerContact: string;
  vehicle: string;
  registration: string;
  vin: string;
  bookingType: string;
  mobileLocation: string;
  assignedMechanic: string;
  jobType: string;
  status: string;
  priority: string;
  estimate: number;
  paid: number;
  dueDate: string;
  partsNotes: string;
  qualityNotes: string;
  notes: string;
  attachments: WorkshopAttachment[];
  createdAt: string;
  updatedAt: string;
}

type WorkshopAttachmentType = 'Vehicle photo' | 'Parts slip';

interface WorkshopAttachment {
  id: string;
  type: WorkshopAttachmentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  srcImg: string;
  storagePath: string;
  createdAt: string;
}

interface WorkshopNavItem {
  id: WorkshopPage;
  label: string;
  icon: string;
}

interface WorkshopMetric {
  label: string;
  value: string | number;
  tone: string;
}

interface WorkshopBoardColumn {
  title: string;
  statuses: string[];
}

interface WorkshopMechanic {
  id: string;
  name: string;
  phone: string;
  skills: string;
  active: boolean;
}

interface CalendarDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: WorkshopJob[];
}

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnDestroy, OnInit {
  readonly maxImages = 50;
  readonly landingImageLimit = 5;
  readonly descriptionLimit = 50;
  readonly currentYear = new Date().getFullYear();
  readonly defaultLocation = 'Meyerton, Gauteng, South Africa';
  readonly defaultCallNumber = '067 825 2864';
  readonly defaultWhatsappNumber = '073 015 1945';
  readonly defaultEmailAddress = 'ab@abautomobile.co.za';
  private readonly galleryStorageKey = 'abautomobile-gallery-images';
  private readonly galleryInitializedStorageKey = 'abautomobile-gallery-initialized';
  private readonly locationStorageKey = 'abautomobile-workshop-location';
  private readonly callNumberStorageKey = 'abautomobile-call-number';
  private readonly whatsappNumberStorageKey = 'abautomobile-whatsapp-number';
  private readonly emailAddressStorageKey = 'abautomobile-email-address';
  private readonly workshopJobsStorageKey = 'abautomobile-workshop-jobs';
  private readonly workshopMechanicsStorageKey = 'abautomobile-workshop-mechanics';
  private readonly workshopStorageFeeStorageKey = 'abautomobile-workshop-storage-fee';
  private readonly signInTimeoutMs = 22000;
  private readonly adminInactivityMs = 10 * 60 * 1000;
  private readonly slowSignInNoticeMs = 6000;
  private readonly maxUploadBytes = 5 * 1024 * 1024;
  private readonly allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  private adminInactivityTimer: ReturnType<typeof setTimeout> | undefined;
  private signInSlowTimer: ReturnType<typeof setTimeout> | undefined;

  services: ServiceItem[] = [
    {
      icon: 'fa-wrench',
      title: 'Minor and major services',
      description: 'Oil, filters, fluids, inspections and scheduled maintenance handled with clean workmanship.'
    },
    {
      icon: 'fa-stethoscope',
      title: 'Diagnostics',
      description: 'Fault scanning and practical repair guidance before parts are replaced.'
    },
    {
      icon: 'fa-cogs',
      title: 'Engine repairs',
      description: 'Engine rebuild support, timing belt work, leak checks and performance concerns.'
    },
    {
      icon: 'fa-car',
      title: 'Suspension and brakes',
      description: 'Shocks, bearings, control arms, discs, pads and road-safety repairs.'
    }
  ];

  promises = [
    'Workshop service in Meyerton, plus mobile support around surrounding Gauteng areas.',
    'Clear communication before work starts and before extra parts are fitted.',
    'A tidy finish so the vehicle leaves cleaner, safer and ready for the road.'
  ];

  readonly adminPanels: Array<{ id: AdminPanel; icon: string; title: string; description: string }> = [
    {
      id: 'images',
      icon: 'fa-picture-o',
      title: 'Manage images',
      description: 'Add, describe and remove gallery photos.'
    },
    {
      id: 'info',
      icon: 'fa-address-card-o',
      title: 'Manage info',
      description: 'Update location, phone, WhatsApp and email.'
    },
    {
      id: 'workshop',
      icon: 'fa-clipboard',
      title: 'Workshop management',
      description: 'Track vehicles, jobs, payments and next steps.'
    }
  ];

  readonly workshopStatuses = ['Booked', 'Checked in', 'Diagnosing', 'Waiting for parts', 'In repair', 'Ready for collection', 'Collected'];
  readonly workshopPriorities = ['Normal', 'Urgent', 'Waiting customer', 'Warranty check'];
  readonly bookingTypes = ['Workshop booking', 'Mobile booking'];
  readonly workshopManagementNav: WorkshopNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-tachometer' },
    { id: 'calendar', label: 'Calendar', icon: 'fa-calendar' },
    { id: 'bookings', label: 'Bookings', icon: 'fa-book' },
    { id: 'board', label: 'Workshop Board', icon: 'fa-columns' },
    { id: 'job-cards', label: 'Job Cards', icon: 'fa-clipboard' },
    { id: 'estimates', label: 'Estimates', icon: 'fa-calculator' },
    { id: 'payments', label: 'Payments', icon: 'fa-credit-card' },
    { id: 'mechanics', label: 'Mechanics', icon: 'fa-wrench' },
    { id: 'settings', label: 'Settings', icon: 'fa-sliders' }
  ];
  readonly workshopBoardColumns: WorkshopBoardColumn[] = [
    { title: 'Booked', statuses: ['Booked'] },
    { title: 'Checked in', statuses: ['Checked in'] },
    { title: 'Diagnosis', statuses: ['Diagnosing'] },
    { title: 'Waiting', statuses: ['Waiting for parts'] },
    { title: 'In repair', statuses: ['In repair'] },
    { title: 'Ready', statuses: ['Ready for collection'] },
    { title: 'Collected', statuses: ['Collected'] }
  ];

  defaultImages: GalleryImage[] = [
    { srcImg: 'assets/img/ABAuto/dignostics.jpg', title: 'Diagnostic checks' },
    { srcImg: 'assets/img/ABAuto/Engine.jpg', title: 'Engine bay inspection' },
    { srcImg: 'assets/img/ABAuto/Golf4.jpg', title: 'Volkswagen service' },
    { srcImg: 'assets/img/ABAuto/HyndaiE.jpg', title: 'Hyundai repair work' },
    { srcImg: 'assets/img/ABAuto/HyndaiEngine.jpg', title: 'Engine repair detail' },
    { srcImg: 'assets/img/ABAuto/timingBelt.jpg', title: 'Timing belt service' },
    { srcImg: 'assets/img/ABAuto/PoloWheel.jpg', title: 'Wheel and suspension work' },
    { srcImg: 'assets/img/ABAuto/workman.jpg', title: 'Workshop repair' },
    { srcImg: 'assets/img/ABAuto/workman2.jpg', title: 'Hands-on servicing' },
    { srcImg: 'assets/img/ABAuto/Corsa.jpg', title: 'Corsa maintenance' }
  ];

  galleryImages: GalleryImage[] = [];
  workshopLocation = this.defaultLocation;
  locationDraft = this.defaultLocation;
  callNumber = this.defaultCallNumber;
  whatsappNumber = this.defaultWhatsappNumber;
  emailAddress = this.defaultEmailAddress;
  callNumberDraft = this.defaultCallNumber;
  whatsappNumberDraft = this.defaultWhatsappNumber;
  emailAddressDraft = this.defaultEmailAddress;
  isSignedIn = false;
  showAdmin = false;
  signInError = '';
  signInStatus = '';
  uploadError = '';
  adminNotice = '';
  descriptionDraft = '';
  isSigningIn = false;
  isProcessingImages = false;
  isSavingLocation = false;
  isSavingContactDetails = false;
  isSavingWorkshopJob = false;
  isUploadingWorkshopAttachment = false;
  removingWorkshopAttachmentIds = new Set<string>();
  savingImageTitleIndexes = new Set<number>();
  removingImageIndexes = new Set<number>();
  showPassword = false;
  isGalleryPage = false;
  isSignInPage = false;
  isWorkshopManagementPage = false;
  activeSection = '';
  activeWorkshopPage: WorkshopPage = 'dashboard';
  activeAdminPanel: AdminPanel = 'images';
  adminRefreshKey = 0;
  activeGalleryIndex: number | null = null;
  workshopJobs: WorkshopJob[] = [];
  workshopMechanics: WorkshopMechanic[] = [];
  editingWorkshopJobId: string | null = null;
  workshopDraft: Omit<WorkshopJob, 'id' | 'createdAt' | 'updatedAt'> = this.createEmptyWorkshopDraft();
  mechanicDraft: Omit<WorkshopMechanic, 'id'> = this.createEmptyMechanicDraft();
  bookingSortNewestFirst = true;
  bookingFilter = 'All';
  selectedCalendarDate = new Date().toISOString().slice(0, 10);
  calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  storageFee = 250;
  storageFeeDraft = 250;
  login = {
    username: '',
    password: ''
  };

  constructor(
    private readonly siteService: SupabaseSiteService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setCurrentPage();
    this.loadLocalFallback();
    void this.loadRemoteContent();
    setTimeout(() => {
      this.scrollToCurrentHash();
      this.updateActiveSection();
    });
  }

  ngOnDestroy(): void {
    this.clearAdminInactivityTimer();
    this.clearSignInSlowTimer();
  }

  get mapUrl(): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(this.workshopLocation);
  }

  get callHref(): string {
    return 'tel:' + this.toPhoneHref(this.callNumber);
  }

  get whatsappHref(): string {
    return 'https://wa.me/' + this.toWhatsappHref(this.whatsappNumber);
  }

  get emailHref(): string {
    return 'mailto:' + this.emailAddress.trim();
  }

  get usesRemoteBackend(): boolean {
    return this.siteService.isConfigured;
  }

  get landingGalleryImages(): GalleryImage[] {
    return this.galleryImages.slice(0, this.landingImageLimit);
  }

  get activeGalleryImage(): GalleryImage | null {
    return this.activeGalleryIndex === null ? null : this.galleryImages[this.activeGalleryIndex] || null;
  }

  get isAdminBusy(): boolean {
    return this.isProcessingImages ||
      this.isSavingLocation ||
      this.isSavingContactDetails ||
      this.isSavingWorkshopJob ||
      this.isUploadingWorkshopAttachment ||
      this.savingImageTitleIndexes.size > 0 ||
      this.removingImageIndexes.size > 0;
  }

  get openWorkshopJobs(): number {
    return this.workshopJobs.filter(job => job.status !== 'Collected').length;
  }

  get readyWorkshopJobs(): number {
    return this.workshopJobs.filter(job => job.status === 'Ready for collection').length;
  }

  get waitingPartsJobs(): number {
    return this.workshopJobs.filter(job => job.status === 'Waiting for parts').length;
  }

  get waitingCustomerJobs(): number {
    return this.workshopJobs.filter(job => job.priority === 'Waiting customer').length;
  }

  get outstandingWorkshopBalance(): number {
    return this.workshopJobs.reduce((total, job) => total + Math.max((job.estimate || 0) - (job.paid || 0), 0), 0);
  }

  get orderedWorkshopJobs(): WorkshopJob[] {
    return [...this.workshopJobs].sort((left, right) => {
      const leftDate = left.dueDate || '9999-12-31';
      const rightDate = right.dueDate || '9999-12-31';
      return leftDate.localeCompare(rightDate) || right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  get activeAdminPanelTitle(): string {
    return this.adminPanels.find(panel => panel.id === this.activeAdminPanel)?.title || '';
  }

  get activeWorkshopPageTitle(): string {
    return this.workshopManagementNav.find(item => item.id === this.activeWorkshopPage)?.label || 'Workshop Management';
  }

  get workshopMetrics(): WorkshopMetric[] {
    const inProgressCount = this.workshopJobs.filter(job => job.status === 'In repair').length;
    const waitingCount = this.workshopJobs.filter(job => job.status === 'Waiting for parts').length;
    const overdueCount = this.overdueWorkshopJobs.length;
    return [
      { label: 'Bookings today', value: this.todaysWorkshopJobs.length, tone: 'warm' },
      { label: 'Vehicles checked in', value: this.workshopJobs.filter(job => job.status === 'Checked in').length, tone: 'neutral' },
      { label: 'Open jobs', value: this.openWorkshopJobs, tone: 'strong' },
      { label: 'Jobs in progress', value: inProgressCount, tone: 'blue' },
      { label: 'Waiting for parts', value: waitingCount, tone: 'orange' },
      { label: 'Overdue jobs', value: overdueCount, tone: overdueCount ? 'danger' : 'neutral' },
      { label: 'Ready for collection', value: this.readyWorkshopJobs, tone: 'green' },
      { label: 'Mobile bookings', value: this.mobileBookings.length, tone: 'blue' },
      { label: 'Workshop bookings', value: this.workshopBookings.length, tone: 'neutral' },
      { label: 'Active mechanics', value: this.activeMechanics.length, tone: 'green' }
    ];
  }

  get attentionItems(): string[] {
    const items: string[] = [];
    if (this.overdueWorkshopJobs.length) {
      items.push(this.overdueWorkshopJobs.length + ' job' + (this.overdueWorkshopJobs.length === 1 ? ' is' : 's are') + ' overdue.');
    }
    if (this.readyWorkshopJobs) {
      items.push(this.readyWorkshopJobs + ' vehicle' + (this.readyWorkshopJobs === 1 ? ' is' : 's are') + ' ready for collection.');
    }
    if (this.workshopJobs.some(job => !job.dueDate && job.status !== 'Collected')) {
      items.push('Some open jobs still need an expected completion date.');
    }
    if (this.workshopJobs.some(job => job.priority === 'Waiting customer')) {
      items.push('Customer approval or feedback is still pending.');
    }

    return items.length ? items : ['No urgent workshop issues need attention right now.'];
  }

  get todaysWorkshopJobs(): WorkshopJob[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.orderedWorkshopJobs.filter(job => job.dueDate === today);
  }

  get overdueWorkshopJobs(): WorkshopJob[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.workshopJobs.filter(job => job.dueDate && job.dueDate < today && job.status !== 'Collected');
  }

  get revenueToday(): number {
    return this.todaysWorkshopJobs.reduce((total, job) => total + (job.paid || 0), 0);
  }

  get revenueThisMonth(): number {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return this.workshopJobs
      .filter(job => (job.updatedAt || '').slice(0, 7) === currentMonth)
      .reduce((total, job) => total + (job.paid || 0), 0);
  }

  get activeMechanics(): WorkshopMechanic[] {
    return this.workshopMechanics.filter(mechanic => mechanic.active);
  }

  get workshopBookings(): WorkshopJob[] {
    return this.workshopJobs.filter(job => job.bookingType !== 'Mobile booking');
  }

  get mobileBookings(): WorkshopJob[] {
    return this.workshopJobs.filter(job => job.bookingType === 'Mobile booking');
  }

  get bookingFilters(): string[] {
    return ['All', 'Workshop booking', 'Mobile booking', 'Booked', 'Checked in', 'Diagnosing', 'Waiting for parts', 'In repair', 'Ready for collection', 'Collected'];
  }

  get filteredBookings(): WorkshopJob[] {
    const filtered = this.bookingFilter === 'All'
      ? [...this.workshopJobs]
      : this.workshopJobs.filter(job => job.bookingType === this.bookingFilter || job.status === this.bookingFilter);
    return filtered.sort((left, right) => {
      const leftDate = left.dueDate || '9999-12-31';
      const rightDate = right.dueDate || '9999-12-31';
      return this.bookingSortNewestFirst
        ? rightDate.localeCompare(leftDate) || right.updatedAt.localeCompare(left.updatedAt)
        : leftDate.localeCompare(rightDate) || left.updatedAt.localeCompare(right.updatedAt);
    });
  }

  get selectedDateBookings(): WorkshopJob[] {
    return this.orderedWorkshopJobs.filter(job => job.dueDate === this.selectedCalendarDate);
  }

  get calendarTitle(): string {
    return this.calendarCursor.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
  }

  get calendarDays(): CalendarDay[] {
    const year = this.calendarCursor.getFullYear();
    const month = this.calendarCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());
    const today = new Date().toISOString().slice(0, 10);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const isoDate = this.toDateInputValue(date);
      return {
        date: isoDate,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: isoDate === today,
        bookings: this.workshopJobs.filter(job => job.dueDate === isoDate)
      };
    });
  }

  get uniqueWorkshopCustomers(): Array<{ name: string; contact: string; jobs: number; balance: number }> {
    const customers = new Map<string, { name: string; contact: string; jobs: number; balance: number }>();
    this.workshopJobs.forEach(job => {
      const key = (job.customerName || 'Unknown customer').toLowerCase();
      const current = customers.get(key) || { name: job.customerName || 'Unknown customer', contact: job.customerContact, jobs: 0, balance: 0 };
      current.jobs++;
      current.contact = current.contact || job.customerContact;
      current.balance += Math.max((job.estimate || 0) - (job.paid || 0), 0);
      customers.set(key, current);
    });
    return Array.from(customers.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  get uniqueWorkshopVehicles(): Array<{ vehicle: string; registration: string; vin: string; customer: string; status: string }> {
    return this.orderedWorkshopJobs.map(job => ({
      vehicle: job.vehicle,
      registration: job.registration || 'Not captured',
      vin: job.vin || 'Not captured',
      customer: job.customerName,
      status: job.status
    }));
  }

  get canIssueInvoiceJobs(): WorkshopJob[] {
    return this.workshopJobs.filter(job => job.estimate > 0 && job.paid >= job.estimate);
  }

  get estimateJobs(): WorkshopJob[] {
    return this.workshopJobs.filter(job => job.estimate > 0 && job.paid < job.estimate);
  }

  setActiveAdminPanel(panel: AdminPanel): void {
    if (panel === 'workshop') {
      this.navigateToWorkshopManagement();
      return;
    }

    this.activeAdminPanel = panel;
    this.markAdminActivity();
  }

  navigateToWorkshopManagement(page: WorkshopPage = 'dashboard', event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.activeWorkshopPage = page;
    this.isGalleryPage = false;
    this.isSignInPage = false;
    this.isWorkshopManagementPage = true;
    this.showAdmin = false;
    this.activeSection = '';
    window.history.pushState({}, '', '/admin/workshop-management/' + page);
    setTimeout(() => window.scrollTo({ top: 0 }));
    this.markAdminActivity();
  }

  startNewWorkshopJob(): void {
    this.resetWorkshopDraft();
    this.uploadError = '';
    this.adminNotice = '';
    this.navigateToWorkshopManagement('bookings');
  }

  selectCalendarDate(date: string): void {
    this.selectedCalendarDate = date;
    this.workshopDraft.dueDate = date;
    this.markAdminActivity();
  }

  moveCalendar(monthOffset: number): void {
    this.calendarCursor = new Date(this.calendarCursor.getFullYear(), this.calendarCursor.getMonth() + monthOffset, 1);
    this.markAdminActivity();
  }

  toggleBookingSort(): void {
    this.bookingSortNewestFirst = !this.bookingSortNewestFirst;
    this.markAdminActivity();
  }

  saveMechanic(): void {
    this.markAdminActivity();
    const name = this.mechanicDraft.name.trim();
    if (!name) {
      this.uploadError = 'Add the mechanic name before saving.';
      return;
    }

    const mechanic: WorkshopMechanic = {
      id: crypto.randomUUID(),
      name,
      phone: this.mechanicDraft.phone.trim(),
      skills: this.mechanicDraft.skills.trim(),
      active: true
    };
    this.workshopMechanics = [...this.workshopMechanics, mechanic];
    this.saveWorkshopMechanics();
    this.mechanicDraft = this.createEmptyMechanicDraft();
    this.adminNotice = 'Mechanic saved.';
    this.uploadError = '';
  }

  toggleMechanic(mechanic: WorkshopMechanic): void {
    this.markAdminActivity();
    this.workshopMechanics = this.workshopMechanics.map(item => item.id === mechanic.id ? { ...item, active: !item.active } : item);
    this.saveWorkshopMechanics();
  }

  removeMechanic(mechanicId: string): void {
    this.markAdminActivity();
    this.workshopMechanics = this.workshopMechanics.filter(mechanic => mechanic.id !== mechanicId);
    this.saveWorkshopMechanics();
  }

  saveWorkshopSettings(): void {
    this.markAdminActivity();
    this.storageFee = Math.max(Number(this.storageFeeDraft) || 0, 0);
    localStorage.setItem(this.workshopStorageFeeStorageKey, String(this.storageFee));
    this.adminNotice = 'Workshop settings saved.';
  }

  openPrintableDocument(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): void {
    this.markAdminActivity();
    if (documentType === 'Invoice' && job.paid < job.estimate) {
      this.uploadError = 'Invoice can only be created after full payment. Send the estimate first.';
      return;
    }

    const documentWindow = window.open('', '_blank');
    if (!documentWindow) {
      this.uploadError = 'Allow pop-ups to open the printable document.';
      return;
    }

    documentWindow.document.write(this.buildPrintableDocument(job, documentType));
    documentWindow.document.close();
    documentWindow.focus();
    documentWindow.print();
  }

  getDocumentEmailHref(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): string {
    const subject = encodeURIComponent("AB's Auto Mobile Mechanic (Pty) Ltd " + documentType + ' - ' + job.vehicle);
    const body = encodeURIComponent(this.buildShareMessage(job, documentType) + '\n\nPlease open the attached PDF after it has been saved from the system.');
    return 'mailto:?subject=' + subject + '&body=' + body;
  }

  getDocumentWhatsappHref(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): string {
    return 'https://wa.me/' + this.toWhatsappHref(job.customerContact || this.whatsappNumber) + '?text=' + encodeURIComponent(this.buildShareMessage(job, documentType));
  }

  navigateToAdminDashboard(event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.navigateToPage('signin');
    this.showAdmin = true;
    this.activeAdminPanel = 'images';
  }

  openAdmin(event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.navigateToPage('signin');

    this.showAdmin = true;
  }

  navigateToSection(section: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.isGalleryPage = false;
    this.isSignInPage = false;
    this.isWorkshopManagementPage = false;
    this.showAdmin = false;
    this.activeSection = section;
    window.history.pushState({}, '', '/#' + section);

    setTimeout(() => {
      this.scrollToSection(section);
      this.activeSection = section;
    });
  }

  navigateToPage(page: SitePage, event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.isGalleryPage = page === 'gallery';
    this.isSignInPage = page === 'signin';
    this.isWorkshopManagementPage = false;
    this.showAdmin = this.isSignInPage;
    this.activeSection = '';

    const nextPath = page === 'home' ? '/' : '/' + page;
    window.history.pushState({}, '', nextPath);

    if (page === 'home') {
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    } else {
      setTimeout(() => window.scrollTo({ top: 0 }));
    }
  }

  isActiveNav(section: string): boolean {
    if (section === 'signin') {
      return this.isSignInPage || this.isWorkshopManagementPage;
    }

    if (section === 'work' && this.isGalleryPage) {
      return true;
    }

    return !this.isGalleryPage && !this.isSignInPage && !this.isWorkshopManagementPage && this.activeSection === section;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateActiveSection();
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    this.setCurrentPage();
    setTimeout(() => {
      this.scrollToCurrentHash();
      this.updateActiveSection();
    });
  }

  @HostListener('window:popstate')
  onPopState(): void {
    this.setCurrentPage();
    setTimeout(() => this.updateActiveSection());
  }

  async signIn(): Promise<void> {
    if (this.isSigningIn) {
      return;
    }

    const username = this.login.username.trim();
    this.signInError = '';
    this.signInStatus = '';

    if (!username || !this.login.password) {
      this.signInError = 'Enter the admin email and password.';
      this.renderState();
      return;
    }

    this.isSigningIn = true;
    this.startSignInSlowTimer();
    this.renderState();

    try {
      if (!this.siteService.isConfigured) {
        this.signInError = 'Admin sign in is not configured.';
        return;
      }

      await this.withTimeout(
        this.siteService.signIn(username, this.login.password),
        this.signInTimeoutMs,
        'Sign in is taking too long. Please check the connection and try again.'
      );
      this.isSignedIn = true;
      this.showAdmin = true;
      this.login.password = '';
      this.signInStatus = '';
      await this.refreshWorkshopAttachmentUrls();
      this.resetAdminInactivityTimer();
      this.renderState();
    } catch (error) {
      this.signInError = error instanceof Error && error.message.indexOf('taking too long') > -1
        ? error.message
        : 'Incorrect sign-in details.';
      this.renderState();
    } finally {
      this.clearSignInSlowTimer();
      this.isSigningIn = false;
      this.renderState();
    }
  }

  async signOut(): Promise<void> {
    this.clearAdminInactivityTimer();
    this.isSignedIn = false;
    this.showAdmin = false;
    this.login = { username: '', password: '' };
    this.uploadError = '';
    this.adminNotice = '';
    this.signInStatus = '';
    this.renderState();

    try {
      await this.withTimeout(
        this.siteService.signOut(),
        this.signInTimeoutMs,
        'Sign out is taking too long.'
      );
    } catch (error) {
      this.signInError = 'Signed out locally. Please refresh if admin access still appears active.';
      this.renderState();
    }
  }

  markAdminActivity(): void {
    if (!this.isSignedIn) {
      return;
    }

    this.resetAdminInactivityTimer();
  }

  isSavingImageTitle(index: number): boolean {
    return this.savingImageTitleIndexes.has(index);
  }

  isRemovingImage(index: number): boolean {
    return this.removingImageIndexes.has(index);
  }

  async onFilesSelected(event: Event): Promise<void> {
    this.markAdminActivity();
    const input = event.target as HTMLInputElement;
    const selectedInputFiles = Array.from(input.files || []);
    const rejectedTypeCount = selectedInputFiles.filter(file => !this.allowedImageTypes.has(file.type)).length;
    const rejectedSizeCount = selectedInputFiles.filter(file => this.allowedImageTypes.has(file.type) && file.size > this.maxUploadBytes).length;
    const files = selectedInputFiles.filter(file => this.allowedImageTypes.has(file.type) && file.size <= this.maxUploadBytes);
    const availableSlots = this.maxImages - this.galleryImages.length;
    this.uploadError = '';
    this.adminNotice = '';

    if (availableSlots <= 0) {
      this.uploadError = 'The gallery already has ' + this.maxImages + ' images. Remove one before adding another.';
      input.value = '';
      return;
    }

    if (!files.length) {
      this.uploadError = rejectedTypeCount || rejectedSizeCount
        ? 'Use JPG, PNG, WebP or GIF images under 5 MB.'
        : 'Choose an image file to add.';
      input.value = '';
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    const skippedCount = files.length - selectedFiles.length;
    const description = this.toShortDescription(this.descriptionDraft);
    this.isProcessingImages = true;

    try {
      const uploadResult = this.siteService.isConfigured
        ? await this.uploadRemoteImages(selectedFiles, description)
        : {
            images: await Promise.all(selectedFiles.map(file => this.readImageFile(file, description))),
            failedCount: 0
          };
      const images = uploadResult.images;
      if (!images.length && uploadResult.failedCount > 0) {
        throw new Error('All selected image uploads failed.');
      }

      this.galleryImages = this.galleryImages.concat(images).slice(0, this.maxImages);
      this.descriptionDraft = '';
      this.refreshAdminGallery('Gallery refreshed with ' + images.length + ' new image' + (images.length === 1 ? '.' : 's.'));
      const notices = [
        uploadResult.failedCount > 0 ? uploadResult.failedCount + ' image' + (uploadResult.failedCount === 1 ? ' could' : 's could') + ' not be added.' : '',
        skippedCount > 0 ? 'Only the first ' + availableSlots + ' images were added to keep the gallery at ' + this.maxImages + '.' : '',
        rejectedTypeCount > 0 ? rejectedTypeCount + ' unsupported file' + (rejectedTypeCount === 1 ? ' was' : 's were') + ' skipped.' : '',
        rejectedSizeCount > 0 ? rejectedSizeCount + ' file' + (rejectedSizeCount === 1 ? ' was' : 's were') + ' over 5 MB and skipped.' : ''
      ].filter(Boolean);
      this.uploadError = notices.join(' ');
    } catch (error) {
      this.uploadError = 'One of those images could not be added.';
    } finally {
      this.isProcessingImages = false;
      input.value = '';
    }
  }

  async updateImageTitle(index: number, title: string): Promise<void> {
    this.markAdminActivity();
    const image = this.galleryImages[index];
    if (!image) {
      return;
    }

    image.title = this.toShortDescription(title);
    if (!this.siteService.isConfigured || !image.id) {
      this.saveGallery();
      return;
    }

    this.savingImageTitleIndexes.add(index);
    try {
      await this.siteService.updateGalleryTitle(image.id, image.title);
      this.adminNotice = 'Image description saved.';
    } catch (error) {
      this.uploadError = 'That image description could not be saved.';
    } finally {
      this.savingImageTitleIndexes.delete(index);
    }
  }

  async removeImage(index: number): Promise<void> {
    this.markAdminActivity();
    const image = this.galleryImages[index];
    if (!image) {
      return;
    }

    this.uploadError = '';
    this.removingImageIndexes.add(index);
    if (this.siteService.isConfigured && image.id) {
      this.isProcessingImages = true;
      try {
        await this.siteService.removeGalleryImage(image.id, image.storagePath || '');
      } catch (error) {
        this.uploadError = 'That image could not be removed.';
        this.isProcessingImages = false;
        this.removingImageIndexes.delete(index);
        return;
      }
      this.isProcessingImages = false;
    }

    this.galleryImages = this.galleryImages.filter((_, itemIndex) => itemIndex !== index);
    if (this.activeGalleryIndex !== null) {
      this.activeGalleryIndex = null;
    }
    this.removingImageIndexes.delete(index);
    this.refreshAdminGallery('Gallery refreshed after removing an image.');
  }

  openGalleryImage(index: number): void {
    if (index < 0 || index >= this.galleryImages.length) {
      return;
    }

    this.activeGalleryIndex = index;
  }

  closeGalleryImage(): void {
    this.activeGalleryIndex = null;
  }

  showPreviousImage(): void {
    if (!this.galleryImages.length || this.activeGalleryIndex === null) {
      return;
    }

    this.activeGalleryIndex = (this.activeGalleryIndex - 1 + this.galleryImages.length) % this.galleryImages.length;
  }

  showNextImage(): void {
    if (!this.galleryImages.length || this.activeGalleryIndex === null) {
      return;
    }

    this.activeGalleryIndex = (this.activeGalleryIndex + 1) % this.galleryImages.length;
  }

  async saveLocation(): Promise<void> {
    this.markAdminActivity();
    const nextLocation = this.locationDraft.trim() || this.defaultLocation;
    this.workshopLocation = nextLocation;
    this.locationDraft = nextLocation;
    this.isSavingLocation = true;
    try {
      await this.persistSettings();
    } finally {
      this.isSavingLocation = false;
    }
  }

  async saveContactDetails(): Promise<void> {
    this.markAdminActivity();
    const nextCallNumber = this.callNumberDraft.trim() || this.defaultCallNumber;
    const nextWhatsappNumber = this.whatsappNumberDraft.trim() || this.defaultWhatsappNumber;
    const nextEmailAddress = this.emailAddressDraft.trim() || this.defaultEmailAddress;
    this.callNumber = nextCallNumber;
    this.whatsappNumber = nextWhatsappNumber;
    this.emailAddress = nextEmailAddress;
    this.callNumberDraft = nextCallNumber;
    this.whatsappNumberDraft = nextWhatsappNumber;
    this.emailAddressDraft = nextEmailAddress;
    this.isSavingContactDetails = true;
    try {
      await this.persistSettings();
    } finally {
      this.isSavingContactDetails = false;
    }
  }

  async saveWorkshopJob(): Promise<void> {
    this.markAdminActivity();
    const customerName = this.workshopDraft.customerName.trim();
    const vehicle = this.workshopDraft.vehicle.trim();

    if (!customerName || !vehicle) {
      this.uploadError = 'Add at least the customer name and vehicle before saving the job.';
      return;
    }

    this.isSavingWorkshopJob = true;
    this.uploadError = '';
    const isNewJob = !this.editingWorkshopJobId;
    const now = new Date().toISOString();
    const cleanJob: WorkshopJob = {
      id: this.editingWorkshopJobId || crypto.randomUUID(),
      customerName,
      customerContact: this.workshopDraft.customerContact.trim(),
      vehicle,
      registration: this.workshopDraft.registration.trim(),
      vin: this.workshopDraft.vin.trim().toUpperCase(),
      bookingType: this.workshopDraft.bookingType || this.bookingTypes[0],
      mobileLocation: this.workshopDraft.bookingType === 'Mobile booking' ? this.workshopDraft.mobileLocation.trim() : '',
      assignedMechanic: this.workshopDraft.assignedMechanic,
      jobType: this.workshopDraft.jobType.trim(),
      status: this.workshopDraft.status || this.workshopStatuses[0],
      priority: this.workshopDraft.priority || this.workshopPriorities[0],
      estimate: Number(this.workshopDraft.estimate) || 0,
      paid: Number(this.workshopDraft.paid) || 0,
      dueDate: this.workshopDraft.dueDate,
      partsNotes: this.workshopDraft.partsNotes.trim(),
      qualityNotes: this.workshopDraft.qualityNotes.trim(),
      notes: this.workshopDraft.notes.trim(),
      attachments: this.workshopJobs.find(job => job.id === this.editingWorkshopJobId)?.attachments || [],
      createdAt: this.workshopJobs.find(job => job.id === this.editingWorkshopJobId)?.createdAt || now,
      updatedAt: now
    };

    await Promise.resolve();
    this.workshopJobs = this.editingWorkshopJobId
      ? this.workshopJobs.map(job => job.id === this.editingWorkshopJobId ? cleanJob : job)
      : [cleanJob, ...this.workshopJobs];
    this.saveWorkshopJobs();
    this.editWorkshopJob(cleanJob);
    this.adminNotice = isNewJob
      ? 'Job card saved. You can now add vehicle photos and parts slips.'
      : 'Workshop job updated.';
    this.isSavingWorkshopJob = false;
    this.renderState();
  }

  editWorkshopJob(job: WorkshopJob): void {
    this.markAdminActivity();
    this.editingWorkshopJobId = job.id;
    this.workshopDraft = {
      customerName: job.customerName,
      customerContact: job.customerContact,
      vehicle: job.vehicle,
      registration: job.registration,
      vin: job.vin,
      bookingType: job.bookingType,
      mobileLocation: job.mobileLocation,
      assignedMechanic: job.assignedMechanic,
      jobType: job.jobType,
      status: job.status,
      priority: job.priority,
      estimate: job.estimate,
      paid: job.paid,
      dueDate: job.dueDate,
      partsNotes: job.partsNotes,
      qualityNotes: job.qualityNotes,
      notes: job.notes,
      attachments: job.attachments
    };
  }

  async addWorkshopAttachments(event: Event, type: WorkshopAttachmentType): Promise<void> {
    this.markAdminActivity();
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';

    if (!this.editingWorkshopJobId) {
      this.uploadError = 'Save the job card first, then add vehicle photos or a parts slip.';
      return;
    }

    if (!files.length) {
      return;
    }

    const allowedTypes = type === 'Vehicle photo'
      ? this.allowedImageTypes
      : new Set([...this.allowedImageTypes, 'application/pdf']);
    const invalidFile = files.find(file => !allowedTypes.has(file.type) || file.size > this.maxUploadBytes);
    if (invalidFile) {
      this.uploadError = type === 'Vehicle photo'
        ? 'Vehicle photos must be JPG, PNG, WEBP or GIF and no larger than 5 MB.'
        : 'Parts slips must be JPG, PNG, WEBP, GIF or PDF and no larger than 5 MB.';
      return;
    }

    const jobIndex = this.workshopJobs.findIndex(job => job.id === this.editingWorkshopJobId);
    if (jobIndex < 0) {
      this.uploadError = 'This job card is no longer available. Reopen it and try again.';
      return;
    }

    this.isUploadingWorkshopAttachment = true;
    this.uploadError = '';
    try {
      const attachments = await Promise.all(files.map(file => this.createWorkshopAttachment(file, type)));
      const job = this.workshopJobs[jobIndex];
      this.workshopJobs = this.workshopJobs.map(item => item.id === job.id
        ? { ...item, attachments: [...item.attachments, ...attachments], updatedAt: new Date().toISOString() }
        : item);
      this.saveWorkshopJobs();
      this.adminNotice = attachments.length + ' ' + (attachments.length === 1 ? 'file' : 'files') + ' added to this job card.';
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'The file could not be added.';
    } finally {
      this.isUploadingWorkshopAttachment = false;
      this.renderState();
    }
  }

  async removeWorkshopAttachment(job: WorkshopJob, attachmentId: string): Promise<void> {
    this.markAdminActivity();
    this.removingWorkshopAttachmentIds.add(attachmentId);
    const attachment = job.attachments.find(item => item.id === attachmentId);
    if (!attachment) {
      this.removingWorkshopAttachmentIds.delete(attachmentId);
      return;
    }

    try {
      if (attachment.storagePath) {
        await this.siteService.removeWorkshopAttachment(attachment.storagePath, attachment.type);
      }
      this.workshopJobs = this.workshopJobs.map(item => item.id === job.id
        ? { ...item, attachments: item.attachments.filter(itemAttachment => itemAttachment.id !== attachmentId), updatedAt: new Date().toISOString() }
        : item);
      this.saveWorkshopJobs();
      this.adminNotice = 'Attachment removed from this job card.';
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'The attachment could not be removed.';
    } finally {
      this.removingWorkshopAttachmentIds.delete(attachmentId);
      this.renderState();
    }
  }

  removeWorkshopJob(jobId: string): void {
    this.markAdminActivity();
    this.workshopJobs = this.workshopJobs.filter(job => job.id !== jobId);
    if (this.editingWorkshopJobId === jobId) {
      this.resetWorkshopDraft();
    }
    this.saveWorkshopJobs();
    this.adminNotice = 'Workshop job removed.';
  }

  resetWorkshopDraft(): void {
    this.editingWorkshopJobId = null;
    this.workshopDraft = this.createEmptyWorkshopDraft();
  }

  private loadLocalFallback(): void {
    this.galleryImages = this.loadLocalGallery();
    this.workshopLocation = localStorage.getItem(this.locationStorageKey) || this.defaultLocation;
    this.locationDraft = this.workshopLocation;
    this.callNumber = localStorage.getItem(this.callNumberStorageKey) || this.defaultCallNumber;
    this.whatsappNumber = localStorage.getItem(this.whatsappNumberStorageKey) || this.defaultWhatsappNumber;
    this.emailAddress = localStorage.getItem(this.emailAddressStorageKey) || this.defaultEmailAddress;
    this.callNumberDraft = this.callNumber;
    this.whatsappNumberDraft = this.whatsappNumber;
    this.emailAddressDraft = this.emailAddress;
    this.workshopJobs = this.loadWorkshopJobs();
    this.workshopMechanics = this.loadWorkshopMechanics();
    this.storageFee = Number(localStorage.getItem(this.workshopStorageFeeStorageKey)) || 250;
    this.storageFeeDraft = this.storageFee;
  }

  private async loadRemoteContent(): Promise<void> {
    if (!this.siteService.isConfigured) {
      return;
    }

    try {
      const [settings, gallery] = await Promise.all([
        this.siteService.loadSettings(),
        this.siteService.loadGallery(this.maxImages)
      ]);

      if (settings) {
        this.workshopLocation = settings.location || this.defaultLocation;
        this.callNumber = settings.callNumber || this.defaultCallNumber;
        this.whatsappNumber = settings.whatsappNumber || this.defaultWhatsappNumber;
        this.emailAddress = settings.emailAddress || this.defaultEmailAddress;
        this.locationDraft = this.workshopLocation;
        this.callNumberDraft = this.callNumber;
        this.whatsappNumberDraft = this.whatsappNumber;
        this.emailAddressDraft = this.emailAddress;
      }

      if (gallery) {
        this.galleryImages = gallery.map(image => ({
          ...image,
          title: this.toShortDescription(image.title)
        }));
      }
    } catch (error) {
      this.adminNotice = 'Using fallback content until Supabase is reachable.';
    }
  }

  private async persistSettings(): Promise<void> {
    if (!this.siteService.isConfigured) {
      localStorage.setItem(this.locationStorageKey, this.workshopLocation);
      localStorage.setItem(this.callNumberStorageKey, this.callNumber);
      localStorage.setItem(this.whatsappNumberStorageKey, this.whatsappNumber);
      localStorage.setItem(this.emailAddressStorageKey, this.emailAddress);
      this.adminNotice = 'Site information saved in this browser.';
      return;
    }

    try {
      await this.siteService.saveSettings({
        location: this.workshopLocation,
        callNumber: this.callNumber,
        whatsappNumber: this.whatsappNumber,
        emailAddress: this.emailAddress
      });
      this.adminNotice = 'Site information saved for all visitors.';
    } catch (error) {
      this.uploadError = 'Site information could not be saved.';
    }
  }

  private async uploadRemoteImages(files: File[], description: string): Promise<{ images: GalleryImage[]; failedCount: number }> {
    const startIndex = this.galleryImages.length;
    const results = await Promise.allSettled(files.map((file, index) =>
      this.siteService.uploadGalleryImage(file, description, startIndex + index + 1)
    ));
    const images = results
      .filter((result): result is PromiseFulfilledResult<StoredGalleryImage> => result.status === 'fulfilled')
      .map(result => result.value);

    return {
      images,
      failedCount: results.length - images.length
    };
  }

  private loadLocalGallery(): GalleryImage[] {
    const storedGallery = localStorage.getItem(this.galleryStorageKey);
    const hasSavedGallery = localStorage.getItem(this.galleryInitializedStorageKey) === 'true';
    if (!storedGallery) {
      return hasSavedGallery ? [] : this.defaultImages.slice(0, this.maxImages);
    }

    try {
      const parsedGallery = JSON.parse(storedGallery) as GalleryImage[];
      if (Array.isArray(parsedGallery)) {
        return parsedGallery.filter(item => item && item.srcImg).map(item => ({
          ...item,
          srcImg: item.srcImg,
          title: this.toShortDescription(item.title)
        })).slice(0, this.maxImages);
      }
    } catch (error) {
      localStorage.removeItem(this.galleryStorageKey);
      localStorage.removeItem(this.galleryInitializedStorageKey);
    }

    return this.defaultImages.slice(0, this.maxImages);
  }

  private saveGallery(): void {
    if (this.siteService.isConfigured) {
      return;
    }

    localStorage.setItem(this.galleryStorageKey, JSON.stringify(this.galleryImages.slice(0, this.maxImages)));
    localStorage.setItem(this.galleryInitializedStorageKey, 'true');
  }

  private loadWorkshopJobs(): WorkshopJob[] {
    const storedJobs = localStorage.getItem(this.workshopJobsStorageKey);
    if (!storedJobs) {
      return [];
    }

    try {
      const parsedJobs = JSON.parse(storedJobs) as WorkshopJob[];
      if (Array.isArray(parsedJobs)) {
        return parsedJobs
          .filter(job => job && job.id && job.customerName && job.vehicle)
          .map(job => ({
            ...job,
            estimate: Number(job.estimate) || 0,
            paid: Number(job.paid) || 0,
            status: job.status || this.workshopStatuses[0],
            priority: job.priority || this.workshopPriorities[0],
            vin: (job.vin || '').toUpperCase(),
            bookingType: job.bookingType || this.bookingTypes[0],
            mobileLocation: job.mobileLocation || '',
            assignedMechanic: job.assignedMechanic || '',
            partsNotes: job.partsNotes || '',
            qualityNotes: job.qualityNotes || '',
            notes: job.notes || '',
            attachments: Array.isArray(job.attachments)
              ? job.attachments.filter(attachment => attachment && attachment.id && attachment.fileName)
              : []
          }));
      }
    } catch (error) {
      localStorage.removeItem(this.workshopJobsStorageKey);
    }

    return [];
  }

  private saveWorkshopJobs(): void {
    localStorage.setItem(this.workshopJobsStorageKey, JSON.stringify(this.workshopJobs));
  }

  private loadWorkshopMechanics(): WorkshopMechanic[] {
    const storedMechanics = localStorage.getItem(this.workshopMechanicsStorageKey);
    if (!storedMechanics) {
      return [
        { id: crypto.randomUUID(), name: 'AB Workshop Mechanic', phone: this.callNumber, skills: 'Diagnostics, servicing and repairs', active: true }
      ];
    }

    try {
      const parsedMechanics = JSON.parse(storedMechanics) as WorkshopMechanic[];
      if (Array.isArray(parsedMechanics)) {
        return parsedMechanics
          .filter(mechanic => mechanic && mechanic.id && mechanic.name)
          .map(mechanic => ({
            ...mechanic,
            phone: mechanic.phone || '',
            skills: mechanic.skills || '',
            active: mechanic.active !== false
          }));
      }
    } catch (error) {
      localStorage.removeItem(this.workshopMechanicsStorageKey);
    }

    return [];
  }

  private saveWorkshopMechanics(): void {
    localStorage.setItem(this.workshopMechanicsStorageKey, JSON.stringify(this.workshopMechanics));
  }

  private createEmptyWorkshopDraft(): Omit<WorkshopJob, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      customerName: '',
      customerContact: '',
      vehicle: '',
      registration: '',
      vin: '',
      bookingType: 'Workshop booking',
      mobileLocation: '',
      assignedMechanic: '',
      jobType: '',
      status: 'Booked',
      priority: 'Normal',
      estimate: 0,
      paid: 0,
      dueDate: '',
      partsNotes: '',
      qualityNotes: '',
      notes: '',
      attachments: []
    };
  }

  private createEmptyMechanicDraft(): Omit<WorkshopMechanic, 'id'> {
    return {
      name: '',
      phone: '',
      skills: '',
      active: true
    };
  }

  private refreshAdminGallery(message: string): void {
    this.saveGallery();
    this.adminRefreshKey++;
    this.adminNotice = message;
  }

  private resetAdminInactivityTimer(): void {
    this.clearAdminInactivityTimer();
    this.adminInactivityTimer = setTimeout(() => void this.handleAdminInactivity(), this.adminInactivityMs);
  }

  private clearAdminInactivityTimer(): void {
    if (this.adminInactivityTimer) {
      clearTimeout(this.adminInactivityTimer);
      this.adminInactivityTimer = undefined;
    }
  }

  private startSignInSlowTimer(): void {
    this.clearSignInSlowTimer();
    this.signInSlowTimer = setTimeout(() => {
      this.signInStatus = 'Still connecting to secure admin sign in...';
      this.renderState();
    }, this.slowSignInNoticeMs);
  }

  private clearSignInSlowTimer(): void {
    if (this.signInSlowTimer) {
      clearTimeout(this.signInSlowTimer);
      this.signInSlowTimer = undefined;
    }
  }

  private async handleAdminInactivity(): Promise<void> {
    if (!this.isSignedIn) {
      return;
    }

    if (this.isAdminBusy) {
      this.resetAdminInactivityTimer();
      return;
    }

    await this.signOut();
    this.signInError = 'Signed out after 10 minutes of inactivity.';
    this.renderState();
  }

  private renderState(): void {
    this.changeDetector.detectChanges();
  }

  private readImageFile(file: File, description: string): Promise<GalleryImage> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        srcImg: String(reader.result),
        title: description || this.toShortDescription(file.name.replace(/\.[^/.]+$/, ''))
      });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private toShortDescription(value: string): string {
    return (value || '').trim().slice(0, this.descriptionLimit);
  }

  private toPhoneHref(value: string): string {
    return value.replace(/[^\d+]/g, '');
  }

  private toWhatsappHref(value: string): string {
    const cleanedNumber = value.replace(/\D/g, '');
    return cleanedNumber.startsWith('0') ? '27' + cleanedNumber.slice(1) : cleanedNumber;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  private buildShareMessage(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): string {
    const amountLine = documentType === 'Invoice'
      ? 'Invoice paid: R' + job.paid
      : 'Estimated amount: R' + job.estimate;
    return [
      "AB's Auto Mobile Mechanic (Pty) Ltd",
      documentType + ' for ' + job.vehicle,
      'Customer: ' + job.customerName,
      'Registration: ' + (job.registration || 'Not captured'),
      'VIN: ' + (job.vin || 'Not captured'),
      'Status: ' + job.status,
      'Job card evidence: ' + job.attachments.length + ' file' + (job.attachments.length === 1 ? '' : 's'),
      amountLine,
      'Please reply on WhatsApp if anything needs to be updated.'
    ].join('\n');
  }

  private buildPrintableDocument(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): string {
    const balance = Math.max((job.estimate || 0) - (job.paid || 0), 0);
    const photos = job.attachments.filter(attachment => attachment.type === 'Vehicle photo' && attachment.srcImg);
    const slips = job.attachments.filter(attachment => attachment.type === 'Parts slip');
    const slipImages = slips.filter(slip => slip.mimeType.startsWith('image/') && slip.srcImg);
    const slipFiles = slips.filter(slip => !slip.mimeType.startsWith('image/'));
    const photoHtml = photos.length
      ? '<section class="evidence"><h2>Vehicle condition photos</h2><div class="photo-grid">' + photos.map(photo =>
        '<figure><img src="' + this.escapeHtml(photo.srcImg) + '" alt="Vehicle condition photo"><figcaption>' + this.escapeHtml(photo.fileName) + '</figcaption></figure>'
      ).join('') + '</div></section>'
      : '<section class="evidence"><h2>Vehicle condition photos</h2><p>No vehicle photos were attached to this job card.</p></section>';
    const slipHtml = '<section class="evidence"><h2>Parts and supplier slips</h2>' + (slips.length
      ? (slipImages.length
          ? '<div class="photo-grid">' + slipImages.map(slip =>
            '<figure><img src="' + this.escapeHtml(slip.srcImg) + '" alt="Parts supplier slip"><figcaption>' + this.escapeHtml(slip.fileName) + '</figcaption></figure>'
          ).join('') + '</div>'
          : '') + (slipFiles.length
          ? '<ul>' + slipFiles.map(slip => '<li>' + this.escapeHtml(slip.fileName) + ' - added ' + this.escapeHtml(new Date(slip.createdAt).toLocaleDateString('en-ZA')) + '</li>').join('') + '</ul>'
          : '')
      : '<p>No parts or supplier slip files were attached to this job card.</p>') + '</section>';
    return `
      <!doctype html>
      <html>
        <head>
          <title>${this.escapeHtml(documentType)} - ${this.escapeHtml(job.vehicle)}</title>
          <style>
            body { color: #172029; font-family: Arial, sans-serif; margin: 34px; }
            header { border-bottom: 4px solid #f2b84b; margin-bottom: 24px; padding-bottom: 18px; }
            h1 { margin: 0 0 8px; }
            table { border-collapse: collapse; margin-top: 18px; width: 100%; }
            td, th { border: 1px solid #d9dee3; padding: 10px; text-align: left; }
            th { background: #172029; color: #fff; }
            .note { background: #f7f8f9; border: 1px solid #d9dee3; margin-top: 18px; padding: 14px; }
            .evidence { border-top: 2px solid #f2b84b; margin-top: 22px; padding-top: 12px; }
            .evidence h2 { font-size: 18px; margin: 0 0 10px; }
            .photo-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
            figure { break-inside: avoid; margin: 0; }
            figure img { border: 1px solid #d9dee3; max-height: 280px; object-fit: contain; width: 100%; }
            figcaption { color: #52606b; font-size: 12px; margin-top: 5px; overflow-wrap: anywhere; }
            @media print { body { margin: 18px; } .photo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
          </style>
        </head>
        <body>
          <header>
            <h1>AB's Auto Mobile Mechanic (Pty) Ltd</h1>
            <strong>${this.escapeHtml(documentType)}</strong>
            <p>${this.escapeHtml(this.workshopLocation)} | ${this.escapeHtml(this.callNumber)} | ${this.escapeHtml(this.emailAddress)}</p>
          </header>
          <table>
            <tr><th>Customer</th><td>${this.escapeHtml(job.customerName)}</td></tr>
            <tr><th>Contact</th><td>${this.escapeHtml(job.customerContact || '')}</td></tr>
            <tr><th>Vehicle</th><td>${this.escapeHtml(job.vehicle)}</td></tr>
            <tr><th>Registration</th><td>${this.escapeHtml(job.registration || '')}</td></tr>
            <tr><th>VIN</th><td>${this.escapeHtml(job.vin || '')}</td></tr>
            <tr><th>Booking type</th><td>${this.escapeHtml(job.bookingType)}</td></tr>
            <tr><th>Location</th><td>${this.escapeHtml(job.mobileLocation || this.workshopLocation)}</td></tr>
            <tr><th>Mechanic</th><td>${this.escapeHtml(job.assignedMechanic || 'Not assigned')}</td></tr>
            <tr><th>Status</th><td>${this.escapeHtml(job.status)}</td></tr>
            <tr><th>Estimate</th><td>R${job.estimate || 0}</td></tr>
            <tr><th>Paid</th><td>R${job.paid || 0}</td></tr>
            <tr><th>Balance</th><td>R${balance}</td></tr>
          </table>
          <div class="note"><strong>Work notes</strong><p>${this.escapeHtml(job.notes || 'No notes captured.')}</p></div>
          <div class="note"><strong>Parts and supplier slip notes</strong><p>${this.escapeHtml(job.partsNotes || 'No parts slip notes captured.')}</p></div>
          <div class="note"><strong>Quality control</strong><p>${this.escapeHtml(job.qualityNotes || 'No quality notes captured.')}</p></div>
          ${photoHtml}
          ${slipHtml}
        </body>
      </html>
    `;
  }

  private async createWorkshopAttachment(file: File, type: WorkshopAttachmentType): Promise<WorkshopAttachment> {
    let srcImg = '';
    let storagePath = '';
    if (this.siteService.isConfigured && this.isSignedIn) {
      try {
        const stored = await this.siteService.uploadWorkshopAttachment(file, this.editingWorkshopJobId || crypto.randomUUID(), type);
        srcImg = stored.srcImg;
        storagePath = stored.storagePath;
      } catch (error) {
        if (file.size > 750 * 1024) {
          throw new Error('The secure file upload failed. Check that the workshop Supabase storage setup has been run, then try again.');
        }
      }
    }

    return {
      id: crypto.randomUUID(),
      type,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      srcImg: srcImg || await this.readFileAsDataUrl(file),
      storagePath,
      createdAt: new Date().toISOString()
    };
  }

  private async refreshWorkshopAttachmentUrls(): Promise<void> {
    const refreshable = this.workshopJobs.flatMap(job => job.attachments
      .filter(attachment => attachment.storagePath)
      .map(attachment => ({ jobId: job.id, attachment })));
    if (!refreshable.length || !this.siteService.isConfigured) {
      return;
    }

    const refreshed = await Promise.all(refreshable.map(async ({ jobId, attachment }) => {
      try {
        const srcImg = await this.siteService.getWorkshopAttachmentUrl(attachment.storagePath, attachment.type);
        return { jobId, attachmentId: attachment.id, srcImg };
      } catch {
        return null;
      }
    }));
    if (!refreshed.some(Boolean)) {
      return;
    }

    this.workshopJobs = this.workshopJobs.map(job => ({
      ...job,
      attachments: job.attachments.map(attachment => {
        const update = refreshed.find(item => item?.jobId === job.id && item.attachmentId === attachment.id);
        return update ? { ...attachment, srcImg: update.srcImg } : attachment;
      })
    }));
    this.saveWorkshopJobs();
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The selected file could not be read.'));
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.readAsDataURL(file);
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character] || character));
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  private scrollToSection(section: string): void {
    const sectionElement = document.getElementById(section);
    if (!sectionElement) {
      return;
    }

    const topbar = document.querySelector('.topbar');
    const navHeight = topbar?.getBoundingClientRect().height || 0;
    const offset = navHeight > 0 && topbar && window.getComputedStyle(topbar).position === 'fixed'
      ? navHeight + 24
      : 18;
    const top = sectionElement.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }

  private scrollToCurrentHash(): void {
    if (this.isGalleryPage || this.isSignInPage || this.isWorkshopManagementPage || !window.location.hash) {
      return;
    }

    this.scrollToSection(window.location.hash.replace('#', ''));
  }

  private setCurrentPage(): void {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    const workshopPrefix = '/admin/workshop-management';
    this.isWorkshopManagementPage = currentPath === workshopPrefix || currentPath.startsWith(workshopPrefix + '/');
    this.isGalleryPage = currentPath === '/gallery';
    this.isSignInPage = currentPath === '/signin';
    this.showAdmin = this.isSignInPage;
    if (this.isWorkshopManagementPage) {
      const page = currentPath.replace(workshopPrefix, '').replace(/^\//, '') as WorkshopPage;
      this.activeWorkshopPage = this.workshopManagementNav.some(item => item.id === page) ? page : 'dashboard';
      this.isGalleryPage = false;
      this.isSignInPage = false;
      this.showAdmin = false;
    }
  }

  private updateActiveSection(): void {
    if (this.isGalleryPage || this.isSignInPage || this.isWorkshopManagementPage) {
      this.activeSection = '';
      return;
    }

    const sections = ['services', 'work', 'location', 'terms'];
    const activeOffset = 170;
    const currentSection = sections.reduce((active, sectionId) => {
      const section = document.getElementById(sectionId);
      if (!section) {
        return active;
      }

      return section.getBoundingClientRect().top <= activeOffset ? sectionId : active;
    }, '');
    this.activeSection = currentSection || (window.location.hash ? window.location.hash.replace('#', '') : '');
  }
}
