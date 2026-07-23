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
  'mobile-callouts' |
  'job-cards' |
  'customers' |
  'vehicles' |
  'estimates' |
  'invoices' |
  'payments' |
  'parts' |
  'suppliers' |
  'quality-control' |
  'mechanics' |
  'reports' |
  'settings';

interface WorkshopJob {
  id: string;
  customerName: string;
  customerContact: string;
  vehicle: string;
  registration: string;
  jobType: string;
  status: string;
  priority: string;
  estimate: number;
  paid: number;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
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
  readonly workshopManagementNav: WorkshopNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-tachometer' },
    { id: 'calendar', label: 'Calendar', icon: 'fa-calendar' },
    { id: 'bookings', label: 'Bookings', icon: 'fa-book' },
    { id: 'board', label: 'Workshop Board', icon: 'fa-columns' },
    { id: 'mobile-callouts', label: 'Mobile Call-Outs', icon: 'fa-road' },
    { id: 'job-cards', label: 'Job Cards', icon: 'fa-clipboard' },
    { id: 'customers', label: 'Customers', icon: 'fa-users' },
    { id: 'vehicles', label: 'Vehicles', icon: 'fa-car' },
    { id: 'estimates', label: 'Estimates', icon: 'fa-calculator' },
    { id: 'invoices', label: 'Invoices', icon: 'fa-file-text-o' },
    { id: 'payments', label: 'Payments', icon: 'fa-credit-card' },
    { id: 'parts', label: 'Parts', icon: 'fa-cogs' },
    { id: 'suppliers', label: 'Suppliers', icon: 'fa-truck' },
    { id: 'quality-control', label: 'Quality Control', icon: 'fa-check-square-o' },
    { id: 'mechanics', label: 'Mechanics', icon: 'fa-wrench' },
    { id: 'reports', label: 'Reports', icon: 'fa-bar-chart' },
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
  editingWorkshopJobId: string | null = null;
  workshopDraft: Omit<WorkshopJob, 'id' | 'createdAt' | 'updatedAt'> = this.createEmptyWorkshopDraft();
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
      { label: 'Outstanding balance', value: 'R' + this.outstandingWorkshopBalance, tone: 'strong' },
      { label: 'Revenue today', value: 'R' + this.revenueToday, tone: 'green' },
      { label: 'Revenue this month', value: 'R' + this.revenueThisMonth, tone: 'green' }
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
    if (this.outstandingWorkshopBalance > 0) {
      items.push('Outstanding customer balance is R' + this.outstandingWorkshopBalance + '.');
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

  get uniqueWorkshopVehicles(): Array<{ vehicle: string; registration: string; customer: string; status: string }> {
    return this.orderedWorkshopJobs.map(job => ({
      vehicle: job.vehicle,
      registration: job.registration || 'Not captured',
      customer: job.customerName,
      status: job.status
    }));
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
    const now = new Date().toISOString();
    const cleanJob: WorkshopJob = {
      id: this.editingWorkshopJobId || crypto.randomUUID(),
      customerName,
      customerContact: this.workshopDraft.customerContact.trim(),
      vehicle,
      registration: this.workshopDraft.registration.trim(),
      jobType: this.workshopDraft.jobType.trim(),
      status: this.workshopDraft.status || this.workshopStatuses[0],
      priority: this.workshopDraft.priority || this.workshopPriorities[0],
      estimate: Number(this.workshopDraft.estimate) || 0,
      paid: Number(this.workshopDraft.paid) || 0,
      dueDate: this.workshopDraft.dueDate,
      notes: this.workshopDraft.notes.trim(),
      createdAt: this.workshopJobs.find(job => job.id === this.editingWorkshopJobId)?.createdAt || now,
      updatedAt: now
    };

    await Promise.resolve();
    this.workshopJobs = this.editingWorkshopJobId
      ? this.workshopJobs.map(job => job.id === this.editingWorkshopJobId ? cleanJob : job)
      : [cleanJob, ...this.workshopJobs];
    this.saveWorkshopJobs();
    this.resetWorkshopDraft();
    this.adminNotice = 'Workshop job saved.';
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
      jobType: job.jobType,
      status: job.status,
      priority: job.priority,
      estimate: job.estimate,
      paid: job.paid,
      dueDate: job.dueDate,
      notes: job.notes
    };
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
            notes: job.notes || ''
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

  private createEmptyWorkshopDraft(): Omit<WorkshopJob, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      customerName: '',
      customerContact: '',
      vehicle: '',
      registration: '',
      jobType: '',
      status: 'Booked',
      priority: 'Normal',
      estimate: 0,
      paid: 0,
      dueDate: '',
      notes: ''
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
