import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { OperatingHoursEntry, StoredGalleryImage, SupabaseSiteService } from './supabase-site.service';

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
  'archive' |
  'estimates' |
  'payments' |
  'mechanics' |
  'settings';

interface WorkshopJob {
  id: string;
  customerName: string;
  customerContact: string;
  customerEmail: string;
  customerAddress: string;
  customerId: string;
  alternateContact: string;
  preferredContact: string;
  vehicle: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  registration: string;
  vin: string;
  engineNumber: string;
  vehicleColour: string;
  fuelLevel: string;
  keysReceived: string;
  accessoriesReceived: string;
  bookingType: string;
  mobileLocation: string;
  assignedMechanic: string;
  jobType: string;
  status: string;
  priority: string;
  customerApproval: string;
  approvalMethod: string;
  estimate: number;
  diagnosticFee: number;
  labourEstimate: number;
  partsEstimate: number;
  consumablesEstimate: number;
  vatEstimate: number;
  depositRequired: number;
  paid: number;
  paymentDate: string;
  bookingDate: string;
  bookingTime: string;
  dueDate: string;
  mileage: number;
  nextServiceMileage: number;
  partsNotes: string;
  qualityNotes: string;
  notes: string;
  inspection: WorkshopInspection;
  attachments: WorkshopAttachment[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

interface InspectionRow {
  status: string;
  notes: string;
}

interface TyreInspection {
  status: string;
  tread: string;
  pressure: string;
  notes: string;
}

interface BrakeInspection {
  status: string;
  pad: string;
  disc: string;
  notes: string;
}

interface RecommendedWork {
  priority: string;
  repair: string;
  estimate: string;
  decision: string;
}

interface WorkshopInspection {
  intake: Record<string, InspectionRow>;
  warningLights: string[];
  existingDamage: string;
  safety: Record<string, InspectionRow>;
  underBonnet: Record<string, InspectionRow>;
  underVehicle: Record<string, InspectionRow>;
  tyres: Record<string, TyreInspection>;
  tyreActions: string[];
  brakes: Record<string, BrakeInspection>;
  recommendedWork: RecommendedWork[];
  finalQuality: string[];
}

type WorkshopAttachmentType = 'Vehicle photo' | 'Parts slip' | 'Proof of payment';

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

interface QueuedWorkshopAttachment {
  file: File;
  type: WorkshopAttachmentType;
  preview: WorkshopAttachment;
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
  icon: string;
  page: WorkshopPage;
}

interface WorkshopBoardColumn {
  title: string;
  statuses: string[];
  description: string;
  icon: string;
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

interface CalendarMonth {
  date: string;
  label: string;
  bookingCount: number;
}

type RevenuePeriod = 'Daily' | 'Weekly' | 'Monthly';
type RevenueChartType = 'Bar' | 'Line' | 'Area';
type CalendarView = 'Day' | 'Week' | 'Month' | 'Year';
type BoardFlowView = 'Daily' | 'Weekly' | 'Monthly';

interface RevenueChartPoint {
  label: string;
  value: number;
  x: number;
  y: number;
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
  readonly defaultOperatingHours: OperatingHoursEntry[] = [
    { label: 'Mon - Fri', hours: '08:00 - 17:00' },
    { label: 'Sat', hours: '08:00 - 12:00' },
    { label: 'Sun', hours: 'Closed' },
    { label: 'Public Holiday', hours: '08:00 - 12:00' }
  ];
  private readonly galleryStorageKey = 'abautomobile-gallery-images';
  private readonly galleryInitializedStorageKey = 'abautomobile-gallery-initialized';
  private readonly locationStorageKey = 'abautomobile-workshop-location';
  private readonly callNumberStorageKey = 'abautomobile-call-number';
  private readonly whatsappNumberStorageKey = 'abautomobile-whatsapp-number';
  private readonly emailAddressStorageKey = 'abautomobile-email-address';
  private readonly operatingHoursStorageKey = 'abautomobile-operating-hours';
  private readonly workshopJobsStorageKey = 'abautomobile-workshop-jobs';
  private readonly workshopArchiveStorageKey = 'abautomobile-workshop-archive';
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
  readonly customerApprovalStatuses = ['Not requested', 'Awaiting approval', 'Approved', 'Declined'];
  readonly approvalMethods = ['WhatsApp', 'Phone call', 'Email', 'In person', 'Signature'];
  readonly bookingTypes = ['Workshop booking', 'Mobile booking'];
  readonly intakeExteriorItems = ['Front bumper', 'Rear bumper', 'Bonnet', 'Roof', 'Left front fender', 'Right front fender', 'Left doors', 'Right doors', 'Mirrors', 'Windscreen', 'Rear window', 'Headlights', 'Taillights', 'Wheels', 'Tyres'];
  readonly intakeInteriorItems = ['Dashboard', 'Warning lights', 'Radio', 'Air conditioning', 'Seats', 'Carpets', 'Boot', 'Spare wheel', 'Jack', 'Wheel spanner', 'Locking wheel nut key', 'Service book', 'Customer valuables removed'];
  readonly dashboardWarningItems = ['Check engine', 'ABS', 'Airbag', 'Oil pressure', 'Battery', 'Temperature', 'Brake', 'TPMS', 'Other'];
  readonly safetyInspectionItems = ['Lights: head, brake, turn and parking', 'Windscreen, windows and mirrors', 'Wipers and washer operation', 'Horn', 'Dashboard warning lights', 'Seat belts and seat security', 'Air conditioning and heating', 'Steering operation and free play', 'Road-test observations, if authorised'];
  readonly underBonnetItems = ['Engine oil level and condition', 'Coolant / antifreeze', 'Brake fluid', 'Power steering fluid, if applicable', 'Transmission fluid, if accessible', 'Windscreen washer fluid', 'Belts and hoses', 'Air filter', 'Cabin filter', 'Battery charge and condition', 'Battery terminals and connections', 'Visible leaks'];
  readonly underVehicleItems = ['Brake lines and hoses', 'Steering components', 'Suspension, shocks and struts', 'Driveshafts, axles and CV boots', 'Exhaust system and mountings', 'Fuel lines and hoses', 'Fluid leaks', 'Underbody damage or loose shields'];
  readonly tyrePositions = ['LF', 'RF', 'LR', 'RR', 'Spare'];
  readonly brakePositions = ['LF', 'RF', 'LR', 'RR'];
  readonly tyreActions = ['Alignment', 'Balance', 'Rotation', 'Puncture repair', 'Replace tyre(s)', 'None'];
  readonly finalQualityItems = ['Oil level checked', 'Coolant checked', 'Brake fluid checked', 'Leaks checked', 'Battery checked', 'Tyre pressures checked', 'Lights and indicators tested', 'Wipers tested', 'Horn tested', 'Wheel nuts checked', 'Tools removed from vehicle', 'Road test completed, if applicable', 'Warning lights rechecked', 'Vehicle ready for collection'];
  readonly preferredContactOptions = ['Call', 'WhatsApp', 'SMS', 'Email'];
  readonly fuelLevelOptions = ['Empty', '1/4', '1/2', '3/4', 'Full'];
  readonly accessoryOptions = ['Spare wheel', 'Jack', 'Wheel spanner', 'Locking wheel nut key', 'Service book', 'Radio code', 'Wheel caps'];
  readonly intakeStatuses = ['G', 'D', 'N/C'];
  readonly inspectionStatuses = ['OK', 'ATTN', 'URG', 'N/C'];
  readonly tyreAndBrakeStatuses = ['OK', 'A', 'U', 'N/C'];
  readonly recommendationPriorities = ['Monitor', 'Soon', 'Urgent'];
  readonly workshopManagementNav: WorkshopNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-tachometer' },
    { id: 'calendar', label: 'Calendar', icon: 'fa-calendar' },
    { id: 'bookings', label: 'Bookings', icon: 'fa-book' },
    { id: 'board', label: 'Workshop Board', icon: 'fa-columns' },
    { id: 'archive', label: 'Completed Jobs', icon: 'fa-archive' },
    { id: 'estimates', label: 'Estimates', icon: 'fa-calculator' },
    { id: 'payments', label: 'Payments', icon: 'fa-credit-card' },
    { id: 'mechanics', label: 'Mechanics', icon: 'fa-wrench' },
    { id: 'settings', label: 'Settings', icon: 'fa-sliders' }
  ];
  readonly workshopBoardColumns: WorkshopBoardColumn[] = [
    { title: 'Incoming', statuses: ['Booked', 'Checked in'], description: 'Bookings and arrivals', icon: 'fa-sign-in' },
    { title: 'Assessment', statuses: ['Diagnosing'], description: 'Inspect and diagnose', icon: 'fa-search' },
    { title: 'Parts and approval', statuses: ['Waiting for parts'], description: 'Awaiting parts or customer approval', icon: 'fa-cubes' },
    { title: 'Repair bay', statuses: ['In repair'], description: 'Work currently in progress', icon: 'fa-wrench' },
    { title: 'Ready', statuses: ['Ready for collection'], description: 'Final checks and collection', icon: 'fa-check-circle' },
    { title: 'Complete', statuses: ['Collected'], description: 'Collected and ready to archive', icon: 'fa-archive' }
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
  operatingHours: OperatingHoursEntry[] = this.copyOperatingHours(this.defaultOperatingHours);
  operatingHoursDraft: OperatingHoursEntry[] = this.copyOperatingHours(this.defaultOperatingHours);
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
  isSavingOperatingHours = false;
  isSavingWorkshopJob = false;
  isRecordingPayment = false;
  isUploadingWorkshopAttachment = false;
  queuedWorkshopAttachments: QueuedWorkshopAttachment[] = [];
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
  archivedWorkshopJobs: WorkshopJob[] = [];
  workshopMechanics: WorkshopMechanic[] = [];
  editingWorkshopJobId: string | null = null;
  editingMechanicId: string | null = null;
  workshopDraft: Omit<WorkshopJob, 'id' | 'createdAt' | 'updatedAt'> = this.createEmptyWorkshopDraft();
  mechanicDraft: Omit<WorkshopMechanic, 'id'> = this.createEmptyMechanicDraft();
  bookingSortNewestFirst = true;
  bookingFilter = 'All';
  bookingSearch = '';
  archiveSearch = '';
  boardFilter: 'All' | 'Workshop booking' | 'Mobile booking' = 'All';
  boardFlowView: BoardFlowView = 'Weekly';
  activeBoardJobId: string | null = null;
  activeReadyClientActionsJobId: string | null = null;
  boardDropColumnTitle = '';
  activeBoardMenuPlacement: 'above' | 'below' = 'below';
  activeBoardMenuAlignRight = false;
  boardMenuTop = 0;
  boardMenuLeft = 0;
  private draggedBoardJobId: string | null = null;
  private boardClickSuppressedUntil = 0;
  bookingPage = 1;
  readonly bookingsPerPage = 10;
  showBookingModal = false;
  showPaymentModal = false;
  showClientPdfPreview = false;
  isPreparingClientPdf = false;
  clientPdfPreviewUrl: SafeResourceUrl | null = null;
  private clientPdfObjectUrl = '';
  clientPdfPreviewFile: File | null = null;
  clientPdfPreviewJob: WorkshopJob | null = null;
  clientPdfPreviewType: 'Job Card' | 'Estimate' | 'Invoice' = 'Job Card';
  paymentJobId: string | null = null;
  paymentDraft = {
    amount: 0,
    paymentDate: this.toDateInputValue(new Date()),
    proofFile: null as File | null
  };
  selectedCalendarDate = new Date().toISOString().slice(0, 10);
  calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  calendarView: CalendarView = 'Month';
  storageFee = 250;
  storageFeeDraft = 250;
  revenuePeriod: RevenuePeriod = 'Daily';
  revenueChartType: RevenueChartType = 'Bar';
  login = {
    username: '',
    password: ''
  };

  constructor(
    private readonly siteService: SupabaseSiteService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.setCurrentPage();
    this.loadLocalFallback();
    if (this.siteService.hasActiveSession) {
      this.isSignedIn = true;
      this.resetAdminInactivityTimer();
    }
    void this.loadRemoteContent();
    setTimeout(() => {
      this.scrollToCurrentHash();
      this.updateActiveSection();
    });
  }

  ngOnDestroy(): void {
    this.clearAdminInactivityTimer();
    this.clearSignInSlowTimer();
    this.clearClientPdfPreview();
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

  get todayIso(): string {
    return this.toDateInputValue(new Date());
  }

  get isAdminBusy(): boolean {
    return this.isProcessingImages ||
      this.isSavingLocation ||
      this.isSavingContactDetails ||
      this.isSavingOperatingHours ||
      this.isSavingWorkshopJob ||
      this.isRecordingPayment ||
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
    return [
      { label: 'Bookings today', value: this.todaysWorkshopJobs.length, tone: 'warm', icon: 'fa-calendar-check-o', page: 'calendar' },
      { label: 'Checked in', value: this.workshopJobs.filter(job => job.status === 'Checked in').length, tone: 'blue', icon: 'fa-car', page: 'board' },
      { label: 'In repair', value: inProgressCount, tone: 'strong', icon: 'fa-wrench', page: 'board' },
      { label: 'Waiting for parts', value: waitingCount, tone: 'orange', icon: 'fa-cubes', page: 'board' },
      { label: 'Ready to collect', value: this.readyWorkshopJobs, tone: 'green', icon: 'fa-check-circle', page: 'board' }
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
    return this.orderedWorkshopJobs.filter(job => job.bookingDate === today);
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

  get revenueChartPoints(): RevenueChartPoint[] {
    const today = new Date();
    const count = this.revenuePeriod === 'Daily' ? 7 : this.revenuePeriod === 'Weekly' ? 8 : 6;
    const buckets = Array.from({ length: count }, (_, index) => ({ label: '', start: new Date(), end: new Date(), value: 0 }));
    buckets.forEach((bucket, index) => {
      if (this.revenuePeriod === 'Daily') {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1 - index));
        bucket.start = date;
        bucket.end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        bucket.label = date.toLocaleDateString('en-ZA', { weekday: 'short' });
      } else if (this.revenuePeriod === 'Weekly') {
        const day = today.getDay() || 7;
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1 - ((count - 1 - index) * 7));
        bucket.start = start;
        bucket.end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
        bucket.label = start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
      } else {
        const start = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
        bucket.start = start;
        bucket.end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        bucket.label = start.toLocaleDateString('en-ZA', { month: 'short' });
      }
    });
    this.workshopJobs.forEach(job => {
      const date = new Date((job.bookingDate || job.updatedAt) + 'T00:00:00');
      const bucket = buckets.find(item => date >= item.start && date < item.end);
      if (bucket) {
        bucket.value += Number(job.paid) || 0;
      }
    });
    const max = Math.max(...buckets.map(item => item.value), 1);
    return buckets.map((item, index) => ({
      label: item.label,
      value: item.value,
      x: 5 + (index * 90 / (count - 1)),
      y: 37 - ((item.value / max) * 30)
    }));
  }

  get revenueChartTotal(): number {
    return this.revenueChartPoints.reduce((total, point) => total + point.value, 0);
  }

  get revenueChartPolyline(): string {
    return this.revenueChartPoints.map(point => point.x + ',' + point.y).join(' ');
  }

  get revenueChartArea(): string {
    const points = this.revenueChartPoints;
    return '5,37 ' + points.map(point => point.x + ',' + point.y).join(' ') + ' 95,37';
  }

  getRevenueBarHeight(value: number): number {
    const max = Math.max(...this.revenueChartPoints.map(point => point.value), 1);
    return Math.max((value / max) * 100, value ? 8 : 2);
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
    const searchTerm = this.bookingSearch.trim().toLocaleLowerCase();
    const matchingBookings = searchTerm
      ? filtered.filter(job => [
        job.customerName,
        job.customerContact,
        job.vehicle,
        job.registration,
        job.vin,
        job.assignedMechanic,
        job.jobType,
        job.bookingDate
      ].some(value => value.toLocaleLowerCase().includes(searchTerm)))
      : filtered;
    return matchingBookings.sort((left, right) => {
      const leftDate = left.bookingDate || left.createdAt;
      const rightDate = right.bookingDate || right.createdAt;
      return this.bookingSortNewestFirst
        ? rightDate.localeCompare(leftDate) || right.updatedAt.localeCompare(left.updatedAt)
        : leftDate.localeCompare(rightDate) || left.updatedAt.localeCompare(right.updatedAt);
    });
  }

  get paginatedBookings(): WorkshopJob[] {
    const start = (this.bookingPage - 1) * this.bookingsPerPage;
    return this.filteredBookings.slice(start, start + this.bookingsPerPage);
  }

  get bookingPageCount(): number {
    return Math.max(1, Math.ceil(this.filteredBookings.length / this.bookingsPerPage));
  }

  get completedArchiveJobs(): WorkshopJob[] {
    const searchTerm = this.archiveSearch.trim().toLocaleLowerCase();
    const matchingJobs = searchTerm
      ? this.archivedWorkshopJobs.filter(job => [job.customerName, job.customerContact, job.vehicle, job.registration, job.vin, job.bookingDate]
        .some(value => value.toLocaleLowerCase().includes(searchTerm)))
      : this.archivedWorkshopJobs;
    return [...matchingJobs].sort((left, right) => (right.archivedAt || right.updatedAt).localeCompare(left.archivedAt || left.updatedAt));
  }

  get selectedDateBookings(): WorkshopJob[] {
    return this.orderedWorkshopJobs.filter(job => job.bookingDate === this.selectedCalendarDate);
  }

  get calendarTitle(): string {
    const selected = this.calendarDateFromIso(this.selectedCalendarDate);
    if (this.calendarView === 'Day') {
      return selected.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (this.calendarView === 'Week') {
      const start = this.startOfWeek(selected);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + ' - ' + end.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return this.calendarView === 'Year'
      ? String(this.calendarCursor.getFullYear())
      : this.calendarCursor.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
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
        bookings: this.workshopJobs.filter(job => job.bookingDate === isoDate)
      };
    });
  }

  get weekCalendarDays(): CalendarDay[] {
    const start = this.startOfWeek(this.calendarDateFromIso(this.selectedCalendarDate));
    const today = new Date().toISOString().slice(0, 10);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const isoDate = this.toDateInputValue(date);
      return {
        date: isoDate,
        dayNumber: date.getDate(),
        isCurrentMonth: true,
        isToday: isoDate === today,
        bookings: this.workshopJobs.filter(job => job.bookingDate === isoDate).sort((left, right) => left.bookingTime.localeCompare(right.bookingTime))
      };
    });
  }

  get yearCalendarMonths(): CalendarMonth[] {
    const year = this.calendarCursor.getFullYear();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, index, 1);
      const prefix = this.toDateInputValue(date).slice(0, 7);
      return {
        date: this.toDateInputValue(date),
        label: date.toLocaleDateString('en-ZA', { month: 'long' }),
        bookingCount: this.workshopJobs.filter(job => job.bookingDate.startsWith(prefix)).length
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

  get paymentDueJobs(): WorkshopJob[] {
    return this.orderedWorkshopJobs.filter(job => job.estimate > 0 && job.paid < job.estimate);
  }

  get paymentTotalDue(): number {
    return this.paymentDueJobs.reduce((total, job) => total + Math.max(job.estimate - job.paid, 0), 0);
  }

  getWorkshopJobById(jobId: string): WorkshopJob | undefined {
    return this.workshopJobs.find(job => job.id === jobId);
  }

  getJobReference(job: Pick<WorkshopJob, 'id' | 'bookingDate'>): string {
    const datePart = (job.bookingDate || '').replace(/-/g, '') || 'JOB';
    const idPart = (job.id || '').replace(/-/g, '').slice(-5).toUpperCase();
    return 'JOB-' + datePart + '-' + idPart;
  }

  getVehicleServiceHistory(job: WorkshopJob): WorkshopJob[] {
    const vehicleKey = job.vin || job.registration;
    if (!vehicleKey) {
      return [];
    }
    return this.workshopJobs
      .filter(item => item.id !== job.id && (job.vin ? item.vin === job.vin : item.registration === job.registration))
      .sort((left, right) => right.bookingDate.localeCompare(left.bookingDate));
  }

  getDraftVehicleServiceHistory(): WorkshopJob[] {
    if (!this.editingWorkshopJobId) {
      return [];
    }
    const vehicleKey = this.workshopDraft.vin || this.workshopDraft.registration;
    if (!vehicleKey) {
      return [];
    }
    return this.workshopJobs
      .filter(job => job.id !== this.editingWorkshopJobId && (this.workshopDraft.vin ? job.vin === this.workshopDraft.vin : job.registration === this.workshopDraft.registration))
      .sort((left, right) => right.bookingDate.localeCompare(left.bookingDate));
  }

  get boardJobs(): WorkshopJob[] {
    return this.boardFilter === 'All'
      ? this.orderedWorkshopJobs
      : this.orderedWorkshopJobs.filter(job => job.bookingType === this.boardFilter);
  }

  get boardFlowDates(): string[] {
    const selected = this.calendarDateFromIso(this.selectedCalendarDate);
    if (this.boardFlowView === 'Daily') {
      return [this.toDateInputValue(selected)];
    }
    if (this.boardFlowView === 'Weekly') {
      const start = this.startOfWeek(selected);
      return Array.from({ length: 7 }, (_, index) => this.toDateInputValue(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)));
    }
    const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => this.toDateInputValue(new Date(start.getFullYear(), start.getMonth(), index + 1)));
  }

  get boardFlowTitle(): string {
    const selected = this.calendarDateFromIso(this.selectedCalendarDate);
    if (this.boardFlowView === 'Daily') {
      return selected.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (this.boardFlowView === 'Weekly') {
      const start = this.startOfWeek(selected);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + ' - ' + end.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return selected.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
  }

  getBoardJobsForDate(date: string): WorkshopJob[] {
    return this.boardJobs.filter(job => job.bookingDate === date).sort((left, right) => left.bookingTime.localeCompare(right.bookingTime));
  }

  getBoardTimePosition(time: string): number {
    const [hours, minutes] = (time || '09:00').split(':').map(Number);
    const totalMinutes = ((hours || 9) * 60) + (minutes || 0);
    return Math.min(Math.max(((totalMinutes - (8 * 60)) / (10 * 60)) * 100, 0), 86);
  }

  getElevatableStatuses(status: string): string[] {
    const currentIndex = this.workshopStatuses.indexOf(status);
    return currentIndex === -1 ? this.workshopStatuses : this.workshopStatuses.slice(currentIndex);
  }

  isReadyForCollection(job: WorkshopJob): boolean {
    return job.status === 'Ready for collection';
  }

  isCompletedJob(job: WorkshopJob): boolean {
    return job.status === 'Collected';
  }

  getBoardStatusCount(column: WorkshopBoardColumn): number {
    return this.boardJobs.filter(job => column.statuses.includes(job.status)).length;
  }

  getBoardColumnJobs(column: WorkshopBoardColumn): WorkshopJob[] {
    return this.boardJobs
      .filter(job => column.statuses.includes(job.status))
      .sort((left, right) => (left.bookingDate + left.bookingTime).localeCompare(right.bookingDate + right.bookingTime));
  }

  isBoardColumnMenuOpen(column: WorkshopBoardColumn): boolean {
    return this.getBoardColumnJobs(column).some(job => job.id === this.activeBoardJobId || job.id === this.activeReadyClientActionsJobId);
  }

  getWorkshopStatusClass(status: string): string {
    return 'status-' + status.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
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
    this.openNewBooking();
  }

  openNewBooking(date = new Date().toISOString().slice(0, 10)): void {
    this.resetWorkshopDraft();
    this.workshopDraft.bookingDate = date;
    this.uploadError = '';
    this.adminNotice = '';
    this.showBookingModal = true;
    this.navigateToWorkshopManagement('bookings');
  }

  closeBookingModal(): void {
    this.showBookingModal = false;
    this.resetWorkshopDraft();
  }

  openBookingJobCard(job: WorkshopJob): void {
    this.editWorkshopJob(job);
    this.uploadError = '';
    this.adminNotice = '';
    this.showBookingModal = true;
    this.navigateToWorkshopManagement('bookings');
  }

  selectCalendarDate(date: string): void {
    this.selectedCalendarDate = date;
    const selected = this.calendarDateFromIso(date);
    this.calendarCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
    this.markAdminActivity();
  }

  setCalendarView(view: string): void {
    this.calendarView = view as CalendarView;
    this.markAdminActivity();
  }

  moveCalendar(offset: number): void {
    const selected = this.calendarDateFromIso(this.selectedCalendarDate);
    if (this.calendarView === 'Day') {
      selected.setDate(selected.getDate() + offset);
      this.selectCalendarDate(this.toDateInputValue(selected));
    } else if (this.calendarView === 'Week') {
      selected.setDate(selected.getDate() + (offset * 7));
      this.selectCalendarDate(this.toDateInputValue(selected));
    } else if (this.calendarView === 'Year') {
      this.calendarCursor = new Date(this.calendarCursor.getFullYear() + offset, 0, 1);
    } else {
      this.calendarCursor = new Date(this.calendarCursor.getFullYear(), this.calendarCursor.getMonth() + offset, 1);
    }
    this.markAdminActivity();
  }

  openCalendarMonth(date: string): void {
    this.selectCalendarDate(date);
    this.calendarView = 'Month';
  }

  goToCalendarToday(): void {
    this.selectCalendarDate(this.toDateInputValue(new Date()));
    this.calendarView = 'Day';
  }

  toggleBookingSort(): void {
    this.bookingSortNewestFirst = !this.bookingSortNewestFirst;
    this.markAdminActivity();
  }

  setBoardFilter(filter: string): void {
    this.boardFilter = filter as 'All' | 'Workshop booking' | 'Mobile booking';
    this.markAdminActivity();
  }

  setBoardFlowView(view: string): void {
    this.boardFlowView = view as BoardFlowView;
    this.activeBoardJobId = null;
    this.markAdminActivity();
  }

  openPaymentEditor(job: WorkshopJob): void {
    this.paymentJobId = job.id;
    this.paymentDraft = {
      amount: Math.max((job.estimate || 0) - (job.paid || 0), 0),
      paymentDate: this.todayIso,
      proofFile: null
    };
    this.uploadError = '';
    this.adminNotice = '';
    this.showPaymentModal = true;
    this.markAdminActivity();
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.paymentJobId = null;
    this.paymentDraft = { amount: 0, paymentDate: this.todayIso, proofFile: null };
  }

  selectPaymentProof(event: Event): void {
    this.markAdminActivity();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';

    if (!file) {
      return;
    }

    const allowedTypes = new Set([...this.allowedImageTypes, 'application/pdf']);
    if (!allowedTypes.has(file.type) || file.size > this.maxUploadBytes) {
      this.uploadError = 'Proof of payment must be a JPG, PNG, WEBP, GIF or PDF file no larger than 5 MB.';
      return;
    }

    this.uploadError = '';
    this.paymentDraft.proofFile = file;
  }

  clearPaymentProof(): void {
    this.paymentDraft.proofFile = null;
    this.markAdminActivity();
  }

  async recordPayment(): Promise<void> {
    this.markAdminActivity();
    const job = this.workshopJobs.find(item => item.id === this.paymentJobId);
    const amount = Number(this.paymentDraft.amount) || 0;
    const balance = job ? Math.max((job.estimate || 0) - (job.paid || 0), 0) : 0;

    if (!job) {
      this.uploadError = 'This job card is no longer available. Reopen the payment and try again.';
      return;
    }
    if (!amount || amount < 0) {
      this.uploadError = 'Enter the payment amount received.';
      return;
    }
    if (amount > balance) {
      this.uploadError = 'The payment amount cannot be more than the outstanding balance of R' + balance + '.';
      return;
    }
    if (!this.paymentDraft.paymentDate) {
      this.uploadError = 'Select the date the payment was received.';
      return;
    }

    this.isRecordingPayment = true;
    this.uploadError = '';
    try {
      const proof = this.paymentDraft.proofFile
        ? await this.createWorkshopAttachment(this.paymentDraft.proofFile, 'Proof of payment', job.id)
        : null;
      const updatedJob: WorkshopJob = {
        ...job,
        paid: job.paid + amount,
        paymentDate: this.paymentDraft.paymentDate,
        attachments: proof ? [...job.attachments, proof] : job.attachments,
        updatedAt: new Date().toISOString()
      };
      this.workshopJobs = this.workshopJobs.map(item => item.id === job.id ? updatedJob : item);
      this.saveWorkshopJobs();
      if (this.editingWorkshopJobId === job.id) {
        this.workshopDraft = { ...this.workshopDraft, paid: updatedJob.paid, paymentDate: updatedJob.paymentDate, attachments: updatedJob.attachments };
      }
      this.adminNotice = 'Payment of R' + amount + ' recorded' + (proof ? ' with proof attached.' : '.');
      this.closePaymentModal();
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'The payment could not be recorded.';
    } finally {
      this.isRecordingPayment = false;
      this.renderState();
    }
  }

  moveBoardFlow(offset: number): void {
    const selected = this.calendarDateFromIso(this.selectedCalendarDate);
    if (this.boardFlowView === 'Daily') {
      selected.setDate(selected.getDate() + offset);
    } else if (this.boardFlowView === 'Weekly') {
      selected.setDate(selected.getDate() + (offset * 7));
    } else {
      selected.setMonth(selected.getMonth() + offset);
    }
    this.selectCalendarDate(this.toDateInputValue(selected));
    this.activeBoardJobId = null;
  }

  goToBoardToday(): void {
    this.selectCalendarDate(this.toDateInputValue(new Date()));
    this.activeBoardJobId = null;
  }

  toggleBoardJobStatus(job: WorkshopJob, event?: Event): void {
    if (Date.now() < this.boardClickSuppressedUntil) {
      return;
    }

    if (this.isReadyForCollection(job) || this.isCompletedJob(job)) {
      this.activeBoardJobId = null;
      this.activeReadyClientActionsJobId = null;
      this.openBookingJobCard(job);
      return;
    }

    this.activeBoardJobId = this.activeBoardJobId === job.id ? null : job.id;
    if (this.activeBoardJobId && event?.currentTarget instanceof HTMLElement) {
      const menuHeight = 116 + (this.getElevatableStatuses(job.status).length * 34);
      this.positionBoardMenu(event.currentTarget, menuHeight);
    }
    this.markAdminActivity();
  }

  toggleReadyClientActions(job: WorkshopJob, event: Event): void {
    event.stopPropagation();
    this.activeBoardJobId = null;
    this.activeReadyClientActionsJobId = this.activeReadyClientActionsJobId === job.id ? null : job.id;
    if (this.activeReadyClientActionsJobId && event.currentTarget instanceof HTMLElement) {
      this.positionBoardMenu(event.currentTarget, 236);
    }
    this.markAdminActivity();
  }

  getReadyNotificationWhatsappHref(job: WorkshopJob): string {
    const recipient = this.toWhatsappHref(job.customerContact || this.whatsappNumber);
    const message = "Hello " + job.customerName + ", AB's Auto Mobile Mechanic (Pty) Ltd confirms that your " + job.vehicle + " is ready for collection. Please contact us to arrange collection.";
    return 'https://wa.me/' + recipient + '?text=' + encodeURIComponent(message);
  }

  private positionBoardMenu(target: HTMLElement, menuHeight: number): void {
    const rect = target.getBoundingClientRect();
    const menuWidth = 216;
    const gutter = 8;
    const availableBelow = window.innerHeight - rect.bottom;
    const availableAbove = rect.top;
    const opensAbove = availableBelow < menuHeight && availableAbove > availableBelow;
    this.activeBoardMenuPlacement = opensAbove ? 'above' : 'below';
    this.activeBoardMenuAlignRight = false;
    this.boardMenuTop = opensAbove
      ? Math.max(gutter, rect.top - menuHeight - gutter)
      : Math.min(window.innerHeight - menuHeight - gutter, rect.bottom + gutter);
    this.boardMenuLeft = Math.min(Math.max(gutter, rect.left), window.innerWidth - menuWidth - gutter);
  }

  startBoardDrag(event: DragEvent, job: WorkshopJob): void {
    this.draggedBoardJobId = job.id;
    this.activeBoardJobId = null;
    this.activeReadyClientActionsJobId = null;
    this.boardMenuTop = 0;
    this.boardMenuLeft = 0;
    event.dataTransfer?.setData('text/plain', job.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    this.markAdminActivity();
  }

  allowBoardDrop(event: DragEvent, column: WorkshopBoardColumn): void {
    event.preventDefault();
    if (!this.draggedBoardJobId) {
      return;
    }
    this.boardDropColumnTitle = column.title;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  clearBoardDrop(column: WorkshopBoardColumn): void {
    if (this.boardDropColumnTitle === column.title) {
      this.boardDropColumnTitle = '';
    }
  }

  dropBoardJob(event: DragEvent, column: WorkshopBoardColumn): void {
    event.preventDefault();
    const jobId = event.dataTransfer?.getData('text/plain') || this.draggedBoardJobId;
    const job = this.workshopJobs.find(item => item.id === jobId);
    this.boardDropColumnTitle = '';
    this.draggedBoardJobId = null;
    if (!job) {
      return;
    }

    const status = column.statuses.includes(job.status) ? job.status : column.statuses[0];
    if (status !== job.status) {
      this.updateBoardJobStatus(job, status);
    }
  }

  finishBoardDrag(): void {
    this.draggedBoardJobId = null;
    this.boardDropColumnTitle = '';
    this.boardClickSuppressedUntil = Date.now() + 180;
  }

  updateBoardJobStatus(job: WorkshopJob, status: string): void {
    const updatedJob = { ...job, status, updatedAt: new Date().toISOString() };
    this.workshopJobs = this.workshopJobs.map(item => item.id === job.id ? updatedJob : item);
    this.saveWorkshopJobs();
    if (this.editingWorkshopJobId === job.id) {
      this.editWorkshopJob(updatedJob);
    }
    this.activeBoardJobId = null;
    this.activeReadyClientActionsJobId = null;
    this.activeBoardMenuPlacement = 'below';
    this.activeBoardMenuAlignRight = false;
    this.boardMenuTop = 0;
    this.boardMenuLeft = 0;
    this.adminNotice = job.vehicle + ' moved to ' + status + '.';
    this.markAdminActivity();
  }

  archiveWorkshopJob(job: WorkshopJob, event?: Event): void {
    event?.stopPropagation();
    this.markAdminActivity();
    if (!this.isCompletedJob(job)) {
      this.uploadError = 'Only completed and collected jobs can be archived.';
      return;
    }

    const archivedJob: WorkshopJob = { ...job, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.workshopJobs = this.workshopJobs.filter(item => item.id !== job.id);
    this.archivedWorkshopJobs = [archivedJob, ...this.archivedWorkshopJobs.filter(item => item.id !== job.id)];
    if (this.editingWorkshopJobId === job.id) {
      this.closeBookingModal();
    }
    this.saveWorkshopJobs();
    this.saveArchivedWorkshopJobs();
    this.activeBoardJobId = null;
    this.activeReadyClientActionsJobId = null;
    this.adminNotice = job.vehicle + ' moved to Completed Jobs.';
  }

  restoreArchivedWorkshopJob(job: WorkshopJob): void {
    this.markAdminActivity();
    const restoredJob: WorkshopJob = { ...job, status: 'Collected', archivedAt: undefined, updatedAt: new Date().toISOString() };
    this.archivedWorkshopJobs = this.archivedWorkshopJobs.filter(item => item.id !== job.id);
    this.workshopJobs = [restoredJob, ...this.workshopJobs.filter(item => item.id !== job.id)];
    this.saveArchivedWorkshopJobs();
    this.saveWorkshopJobs();
    this.adminNotice = job.vehicle + ' restored to the Complete column.';
  }

  setBookingPage(page: number): void {
    this.bookingPage = Math.min(Math.max(page, 1), this.bookingPageCount);
    this.markAdminActivity();
  }

  setRevenuePeriod(period: string): void {
    this.revenuePeriod = period as RevenuePeriod;
    this.markAdminActivity();
  }

  setRevenueChartType(type: string): void {
    this.revenueChartType = type as RevenueChartType;
    this.markAdminActivity();
  }

  onBookingFilterChange(): void {
    this.bookingPage = 1;
  }

  onBookingSearchChange(): void {
    this.bookingPage = 1;
    this.markAdminActivity();
  }

  applyMileageServiceSuggestion(): void {
    const mileage = Math.max(Number(this.workshopDraft.mileage) || 0, 0);
    if (!this.workshopDraft.nextServiceMileage || this.workshopDraft.nextServiceMileage <= mileage) {
      this.workshopDraft.nextServiceMileage = mileage + 10000;
    }
  }

  syncVehicleDescription(): void {
    this.workshopDraft.vehicle = [
      this.workshopDraft.vehicleMake,
      this.workshopDraft.vehicleModel,
      this.workshopDraft.vehicleYear
    ].filter(Boolean).join(' ');
  }

  refreshEstimateTotal(): void {
    this.workshopDraft.estimate = [
      this.workshopDraft.diagnosticFee,
      this.workshopDraft.labourEstimate,
      this.workshopDraft.partsEstimate,
      this.workshopDraft.consumablesEstimate,
      this.workshopDraft.vatEstimate
    ].reduce((total, value) => total + (Number(value) || 0), 0);
  }

  saveMechanic(): void {
    this.markAdminActivity();
    const name = this.mechanicDraft.name.trim();
    if (!name) {
      this.uploadError = 'Add the mechanic name before saving.';
      return;
    }

    const currentMechanic = this.workshopMechanics.find(mechanic => mechanic.id === this.editingMechanicId);
    const mechanic: WorkshopMechanic = {
      id: this.editingMechanicId || crypto.randomUUID(),
      name,
      phone: this.mechanicDraft.phone.trim(),
      skills: this.mechanicDraft.skills.trim(),
      active: this.mechanicDraft.active
    };
    this.workshopMechanics = currentMechanic
      ? this.workshopMechanics.map(item => item.id === mechanic.id ? mechanic : item)
      : [...this.workshopMechanics, mechanic];
    if (currentMechanic && currentMechanic.name !== mechanic.name) {
      this.workshopJobs = this.workshopJobs.map(job => job.assignedMechanic === currentMechanic.name
        ? { ...job, assignedMechanic: mechanic.name, updatedAt: new Date().toISOString() }
        : job);
      this.saveWorkshopJobs();
    }
    this.saveWorkshopMechanics();
    this.editingMechanicId = null;
    this.mechanicDraft = this.createEmptyMechanicDraft();
    this.adminNotice = currentMechanic ? 'Mechanic updated.' : 'Mechanic added.';
    this.uploadError = '';
  }

  editMechanic(mechanic: WorkshopMechanic): void {
    this.markAdminActivity();
    this.editingMechanicId = mechanic.id;
    this.mechanicDraft = {
      name: mechanic.name,
      phone: mechanic.phone,
      skills: mechanic.skills,
      active: mechanic.active
    };
    this.uploadError = '';
  }

  cancelMechanicEdit(): void {
    this.editingMechanicId = null;
    this.mechanicDraft = this.createEmptyMechanicDraft();
    this.markAdminActivity();
  }

  toggleMechanic(mechanic: WorkshopMechanic): void {
    this.markAdminActivity();
    this.workshopMechanics = this.workshopMechanics.map(item => item.id === mechanic.id ? { ...item, active: !item.active } : item);
    this.saveWorkshopMechanics();
  }

  removeMechanic(mechanicId: string): void {
    this.markAdminActivity();
    this.workshopMechanics = this.workshopMechanics.filter(mechanic => mechanic.id !== mechanicId);
    if (this.editingMechanicId === mechanicId) {
      this.cancelMechanicEdit();
    }
    this.saveWorkshopMechanics();
  }

  saveWorkshopSettings(): void {
    this.markAdminActivity();
    this.storageFee = Math.max(Number(this.storageFeeDraft) || 0, 0);
    localStorage.setItem(this.workshopStorageFeeStorageKey, String(this.storageFee));
    this.adminNotice = 'Workshop settings saved.';
  }

  async openPrintableDocument(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): Promise<void> {
    await this.openClientPdfPreview(job, documentType);
  }

  async openClientPdfPreview(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): Promise<void> {
    this.markAdminActivity();
    if (documentType === 'Invoice' && job.paid < job.estimate) {
      this.uploadError = 'Invoice can only be created after full payment. Send the estimate first.';
      return;
    }
    this.isPreparingClientPdf = true;
    this.uploadError = '';
    try {
      await this.refreshWorkshopAttachmentUrls();
      const printableJob = this.workshopJobs.find(item => item.id === job.id)
        || this.archivedWorkshopJobs.find(item => item.id === job.id)
        || job;
      const file = await this.createClientPdf(printableJob, documentType);
      this.clearClientPdfPreview();
      this.clientPdfPreviewFile = file;
      this.clientPdfPreviewJob = printableJob;
      this.clientPdfPreviewType = documentType;
      this.clientPdfObjectUrl = URL.createObjectURL(file);
      this.clientPdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.clientPdfObjectUrl);
      this.showClientPdfPreview = true;
    } catch (error) {
      console.error('Unable to prepare the client PDF.', error);
      this.uploadError = 'The client PDF could not be prepared. Please try again.';
    } finally {
      this.isPreparingClientPdf = false;
      this.renderState();
    }
  }

  closeClientPdfPreview(): void {
    this.clearClientPdfPreview();
    this.showClientPdfPreview = false;
  }

  downloadClientPdf(): void {
    if (!this.clientPdfPreviewFile) {
      return;
    }
    const url = URL.createObjectURL(this.clientPdfPreviewFile);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.clientPdfPreviewFile.name;
    link.click();
    URL.revokeObjectURL(url);
    this.markAdminActivity();
  }

  async shareClientPdf(): Promise<void> {
    const file = this.clientPdfPreviewFile;
    const job = this.clientPdfPreviewJob;
    if (!file || !job) {
      return;
    }
    const navigatorWithShare = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (navigatorWithShare.share && (!navigatorWithShare.canShare || navigatorWithShare.canShare({ files: [file] }))) {
      try {
        await navigatorWithShare.share({
          title: "AB's Auto Mobile Mechanic (Pty) Ltd " + this.clientPdfPreviewType,
          text: this.buildShareMessage(job, this.clientPdfPreviewType),
          files: [file]
        });
        this.markAdminActivity();
        return;
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') {
          return;
        }
      }
    }
    this.downloadClientPdf();
    this.uploadError = 'PDF downloaded. Attach it to the WhatsApp or email message before sending.';
  }

  getClientPdfEmailHref(): string {
    const job = this.clientPdfPreviewJob;
    return job ? this.getDocumentEmailHref(job, this.clientPdfPreviewType) : '#';
  }

  getClientPdfWhatsappHref(): string {
    const job = this.clientPdfPreviewJob;
    return job ? this.getDocumentWhatsappHref(job, this.clientPdfPreviewType) : '#';
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
    this.closePaymentModal();
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

  addOperatingHoursRow(): void {
    this.markAdminActivity();
    this.operatingHoursDraft = [...this.operatingHoursDraft, { label: '', hours: '' }];
  }

  removeOperatingHoursRow(index: number): void {
    this.markAdminActivity();
    this.operatingHoursDraft = this.operatingHoursDraft.filter((_, itemIndex) => itemIndex !== index);
  }

  async saveOperatingHours(): Promise<void> {
    this.markAdminActivity();
    if (this.operatingHoursDraft.some(entry => !entry.label.trim() || !entry.hours.trim())) {
      this.uploadError = 'Complete or remove every operating-hours row before saving.';
      return;
    }

    this.operatingHours = this.copyOperatingHours(this.operatingHoursDraft);
    this.operatingHoursDraft = this.copyOperatingHours(this.operatingHours);
    this.isSavingOperatingHours = true;
    this.uploadError = '';
    try {
      await this.persistSettings();
    } finally {
      this.isSavingOperatingHours = false;
    }
  }

  async saveWorkshopJob(): Promise<void> {
    this.markAdminActivity();
    const customerName = this.workshopDraft.customerName.trim();
    const vehicle = (this.workshopDraft.vehicle || [this.workshopDraft.vehicleMake, this.workshopDraft.vehicleModel, this.workshopDraft.vehicleYear].filter(Boolean).join(' ')).trim();

    if (!customerName || !vehicle) {
      this.uploadError = 'Add at least the customer name and vehicle before saving the job.';
      return;
    }

    this.isSavingWorkshopJob = true;
    this.uploadError = '';
    const isNewJob = !this.editingWorkshopJobId;
    const queuedAttachments = isNewJob ? [...this.queuedWorkshopAttachments] : [];
    const now = new Date().toISOString();
    const cleanJob: WorkshopJob = {
      id: this.editingWorkshopJobId || crypto.randomUUID(),
      customerName,
      customerContact: this.workshopDraft.customerContact.trim(),
      customerEmail: this.workshopDraft.customerEmail.trim(),
      customerAddress: this.workshopDraft.customerAddress.trim(),
      customerId: this.workshopDraft.customerId.trim(),
      alternateContact: this.workshopDraft.alternateContact.trim(),
      preferredContact: this.workshopDraft.preferredContact,
      vehicle,
      vehicleMake: this.workshopDraft.vehicleMake.trim(),
      vehicleModel: this.workshopDraft.vehicleModel.trim(),
      vehicleYear: this.workshopDraft.vehicleYear.trim(),
      registration: this.workshopDraft.registration.trim(),
      vin: this.workshopDraft.vin.trim().toUpperCase(),
      engineNumber: this.workshopDraft.engineNumber.trim(),
      vehicleColour: this.workshopDraft.vehicleColour.trim(),
      fuelLevel: this.workshopDraft.fuelLevel,
      keysReceived: this.workshopDraft.keysReceived.trim(),
      accessoriesReceived: this.workshopDraft.accessoriesReceived.trim(),
      bookingType: this.workshopDraft.bookingType || this.bookingTypes[0],
      mobileLocation: this.workshopDraft.bookingType === 'Mobile booking' ? this.workshopDraft.mobileLocation.trim() : '',
      assignedMechanic: this.workshopDraft.assignedMechanic,
      jobType: this.workshopDraft.jobType.trim(),
      status: this.workshopDraft.status || this.workshopStatuses[0],
      priority: this.workshopDraft.priority || this.workshopPriorities[0],
      customerApproval: this.workshopDraft.customerApproval || this.customerApprovalStatuses[0],
      approvalMethod: this.workshopDraft.approvalMethod,
      estimate: Number(this.workshopDraft.estimate) || 0,
      diagnosticFee: Number(this.workshopDraft.diagnosticFee) || 0,
      labourEstimate: Number(this.workshopDraft.labourEstimate) || 0,
      partsEstimate: Number(this.workshopDraft.partsEstimate) || 0,
      consumablesEstimate: Number(this.workshopDraft.consumablesEstimate) || 0,
      vatEstimate: Number(this.workshopDraft.vatEstimate) || 0,
      depositRequired: Number(this.workshopDraft.depositRequired) || 0,
      paid: Number(this.workshopDraft.paid) || 0,
      paymentDate: this.workshopDraft.paymentDate || '',
      bookingDate: this.workshopDraft.bookingDate || this.toDateInputValue(new Date()),
      bookingTime: this.workshopDraft.bookingTime || this.toTimeInputValue(new Date()),
      dueDate: this.workshopDraft.dueDate,
      mileage: Math.max(Number(this.workshopDraft.mileage) || 0, 0),
      nextServiceMileage: Math.max(Number(this.workshopDraft.nextServiceMileage) || 0, 0),
      partsNotes: this.workshopDraft.partsNotes.trim(),
      qualityNotes: this.workshopDraft.qualityNotes.trim(),
      notes: this.workshopDraft.notes.trim(),
      inspection: this.normaliseWorkshopInspection(this.workshopDraft.inspection),
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
    if (queuedAttachments.length) {
      await this.saveQueuedWorkshopAttachments(cleanJob, queuedAttachments);
    }
    this.adminNotice = isNewJob
      ? 'Job card saved. You can now add vehicle photos and parts slips.'
      : 'Workshop job updated.';
    this.isSavingWorkshopJob = false;
    this.renderState();
  }

  editWorkshopJob(job: WorkshopJob): void {
    this.markAdminActivity();
    this.editingWorkshopJobId = job.id;
    this.queuedWorkshopAttachments = [];
    this.workshopDraft = {
      customerName: job.customerName,
      customerContact: job.customerContact,
      customerEmail: job.customerEmail || '',
      customerAddress: job.customerAddress || '',
      customerId: job.customerId || '',
      alternateContact: job.alternateContact || '',
      preferredContact: job.preferredContact || 'WhatsApp',
      vehicle: job.vehicle,
      vehicleMake: job.vehicleMake || '',
      vehicleModel: job.vehicleModel || '',
      vehicleYear: job.vehicleYear || '',
      registration: job.registration,
      vin: job.vin,
      engineNumber: job.engineNumber || '',
      vehicleColour: job.vehicleColour || '',
      fuelLevel: job.fuelLevel || '',
      keysReceived: job.keysReceived || '',
      accessoriesReceived: job.accessoriesReceived || '',
      bookingType: job.bookingType,
      mobileLocation: job.mobileLocation,
      assignedMechanic: job.assignedMechanic,
      jobType: job.jobType,
      status: job.status,
      priority: job.priority,
      customerApproval: job.customerApproval,
      approvalMethod: job.approvalMethod,
      estimate: job.estimate,
      diagnosticFee: job.diagnosticFee || 0,
      labourEstimate: job.labourEstimate || 0,
      partsEstimate: job.partsEstimate || 0,
      consumablesEstimate: job.consumablesEstimate || 0,
      vatEstimate: job.vatEstimate || 0,
      depositRequired: job.depositRequired || 0,
      paid: job.paid,
      paymentDate: job.paymentDate || '',
      bookingDate: job.bookingDate,
      bookingTime: job.bookingTime,
      dueDate: job.dueDate,
      mileage: job.mileage,
      nextServiceMileage: job.nextServiceMileage,
      partsNotes: job.partsNotes,
      qualityNotes: job.qualityNotes,
      notes: job.notes,
      inspection: this.normaliseWorkshopInspection(job.inspection),
      attachments: job.attachments
    };
  }

  async addWorkshopAttachments(event: Event, type: WorkshopAttachmentType): Promise<void> {
    this.markAdminActivity();
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';

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
        : (type === 'Proof of payment'
          ? 'Proof of payment must be JPG, PNG, WEBP, GIF or PDF and no larger than 5 MB.'
          : 'Parts slips must be JPG, PNG, WEBP, GIF or PDF and no larger than 5 MB.');
      return;
    }

    if (!this.editingWorkshopJobId) {
      this.isUploadingWorkshopAttachment = true;
      this.uploadError = '';
      try {
        const queued = await Promise.all(files.map(async file => ({
          file,
          type,
          preview: {
            id: crypto.randomUUID(),
            type,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            srcImg: await this.readFileAsDataUrl(file),
            storagePath: '',
            createdAt: new Date().toISOString()
          } as WorkshopAttachment
        })));
        this.queuedWorkshopAttachments = [...this.queuedWorkshopAttachments, ...queued];
        this.workshopDraft.attachments = this.queuedWorkshopAttachments.map(item => item.preview);
        this.adminNotice = queued.length + ' file' + (queued.length === 1 ? '' : 's') + ' ready to attach when this booking is saved.';
      } catch (error) {
        this.uploadError = error instanceof Error ? error.message : 'The file could not be prepared.';
      } finally {
        this.isUploadingWorkshopAttachment = false;
        this.renderState();
      }
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
      const updatedJob = { ...job, attachments: [...job.attachments, ...attachments], updatedAt: new Date().toISOString() };
      this.workshopJobs = this.workshopJobs.map(item => item.id === job.id
        ? updatedJob
        : item);
      this.workshopDraft.attachments = updatedJob.attachments;
      this.saveWorkshopJobs();
      this.adminNotice = attachments.length + ' ' + (attachments.length === 1 ? 'file' : 'files') + ' added to this job card.';
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'The file could not be added.';
    } finally {
      this.isUploadingWorkshopAttachment = false;
      this.renderState();
    }
  }

  private async saveQueuedWorkshopAttachments(job: WorkshopJob, queued: QueuedWorkshopAttachment[]): Promise<void> {
    this.isUploadingWorkshopAttachment = true;
    try {
      const attachments = await Promise.all(queued.map(item => this.createWorkshopAttachment(item.file, item.type)));
      const updatedJob = { ...job, attachments, updatedAt: new Date().toISOString() };
      this.workshopJobs = this.workshopJobs.map(item => item.id === job.id ? updatedJob : item);
      this.saveWorkshopJobs();
      this.editWorkshopJob(updatedJob);
      this.queuedWorkshopAttachments = [];
      this.adminNotice = 'Job card saved with ' + attachments.length + ' evidence file' + (attachments.length === 1 ? '.' : 's.');
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'The queued evidence files could not be attached.';
      this.editWorkshopJob(job);
      this.queuedWorkshopAttachments = queued;
      this.workshopDraft.attachments = queued.map(item => item.preview);
    } finally {
      this.isUploadingWorkshopAttachment = false;
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
      const updatedJob = { ...job, attachments: job.attachments.filter(itemAttachment => itemAttachment.id !== attachmentId), updatedAt: new Date().toISOString() };
      this.workshopJobs = this.workshopJobs.map(item => item.id === job.id
        ? updatedJob
        : item);
      if (this.editingWorkshopJobId === job.id) {
        this.workshopDraft.attachments = updatedJob.attachments;
      }
      this.saveWorkshopJobs();
      this.adminNotice = 'Attachment removed from this job card.';
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'The attachment could not be removed.';
    } finally {
      this.removingWorkshopAttachmentIds.delete(attachmentId);
      this.renderState();
    }
  }

  removeEditingWorkshopAttachment(attachmentId: string): void {
    const job = this.workshopJobs.find(item => item.id === this.editingWorkshopJobId);
    if (!job) {
      this.uploadError = 'This job card is no longer available. Reopen it and try again.';
      return;
    }

    void this.removeWorkshopAttachment(job, attachmentId);
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
    this.queuedWorkshopAttachments = [];
    this.workshopDraft = this.createEmptyWorkshopDraft();
  }

  private loadLocalFallback(): void {
    this.galleryImages = this.loadLocalGallery();
    this.workshopLocation = localStorage.getItem(this.locationStorageKey) || this.defaultLocation;
    this.locationDraft = this.workshopLocation;
    this.callNumber = localStorage.getItem(this.callNumberStorageKey) || this.defaultCallNumber;
    this.whatsappNumber = localStorage.getItem(this.whatsappNumberStorageKey) || this.defaultWhatsappNumber;
    this.emailAddress = localStorage.getItem(this.emailAddressStorageKey) || this.defaultEmailAddress;
    this.operatingHours = this.loadOperatingHours(localStorage.getItem(this.operatingHoursStorageKey));
    this.callNumberDraft = this.callNumber;
    this.whatsappNumberDraft = this.whatsappNumber;
    this.emailAddressDraft = this.emailAddress;
    this.operatingHoursDraft = this.copyOperatingHours(this.operatingHours);
    this.workshopJobs = this.loadWorkshopJobs();
    this.archivedWorkshopJobs = this.loadArchivedWorkshopJobs();
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
        this.operatingHours = this.loadOperatingHours(settings.operatingHours);
        this.locationDraft = this.workshopLocation;
        this.callNumberDraft = this.callNumber;
        this.whatsappNumberDraft = this.whatsappNumber;
        this.emailAddressDraft = this.emailAddress;
        this.operatingHoursDraft = this.copyOperatingHours(this.operatingHours);
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
      localStorage.setItem(this.operatingHoursStorageKey, JSON.stringify(this.operatingHours));
      this.adminNotice = 'Site information saved in this browser.';
      return;
    }

    try {
      await this.siteService.saveSettings({
        location: this.workshopLocation,
        callNumber: this.callNumber,
        whatsappNumber: this.whatsappNumber,
        emailAddress: this.emailAddress,
        operatingHours: this.operatingHours
      });
      this.adminNotice = 'Site information saved for all visitors.';
    } catch (error) {
      this.uploadError = 'Site information could not be saved.';
    }
  }

  private copyOperatingHours(entries: OperatingHoursEntry[]): OperatingHoursEntry[] {
    return entries.map(entry => ({ label: entry.label, hours: entry.hours }));
  }

  private loadOperatingHours(value: OperatingHoursEntry[] | string | null): OperatingHoursEntry[] {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (!Array.isArray(parsed)) {
        return this.copyOperatingHours(this.defaultOperatingHours);
      }

      const entries = parsed
        .filter((entry): entry is OperatingHoursEntry => Boolean(entry) && typeof entry.label === 'string' && typeof entry.hours === 'string')
        .map(entry => ({ label: entry.label.trim(), hours: entry.hours.trim() }))
        .filter(entry => entry.label && entry.hours);
      return entries.length ? entries : this.copyOperatingHours(this.defaultOperatingHours);
    } catch {
      return this.copyOperatingHours(this.defaultOperatingHours);
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
            customerEmail: job.customerEmail || '',
            customerAddress: job.customerAddress || '',
            customerId: job.customerId || '',
            alternateContact: job.alternateContact || '',
            preferredContact: job.preferredContact || 'WhatsApp',
            vehicleMake: job.vehicleMake || '',
            vehicleModel: job.vehicleModel || '',
            vehicleYear: job.vehicleYear || '',
            engineNumber: job.engineNumber || '',
            vehicleColour: job.vehicleColour || '',
            fuelLevel: job.fuelLevel || '',
            keysReceived: job.keysReceived || '',
            accessoriesReceived: job.accessoriesReceived || '',
            diagnosticFee: Number(job.diagnosticFee) || 0,
            labourEstimate: Number(job.labourEstimate) || 0,
            partsEstimate: Number(job.partsEstimate) || 0,
            consumablesEstimate: Number(job.consumablesEstimate) || 0,
            vatEstimate: Number(job.vatEstimate) || 0,
            depositRequired: Number(job.depositRequired) || 0,
            paymentDate: job.paymentDate || '',
            bookingDate: job.bookingDate || job.dueDate || (job.createdAt || this.toDateInputValue(new Date())).slice(0, 10),
            bookingTime: job.bookingTime || '',
            status: job.status || this.workshopStatuses[0],
            priority: job.priority || this.workshopPriorities[0],
            customerApproval: job.customerApproval || this.customerApprovalStatuses[0],
            approvalMethod: job.approvalMethod || '',
            vin: (job.vin || '').toUpperCase(),
            bookingType: job.bookingType || this.bookingTypes[0],
            mobileLocation: job.mobileLocation || '',
            assignedMechanic: job.assignedMechanic || '',
            partsNotes: job.partsNotes || '',
            qualityNotes: job.qualityNotes || '',
            notes: job.notes || '',
            inspection: this.normaliseWorkshopInspection(job.inspection),
            mileage: Math.max(Number(job.mileage) || 0, 0),
            nextServiceMileage: Math.max(Number(job.nextServiceMileage) || 0, 0),
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

  private loadArchivedWorkshopJobs(): WorkshopJob[] {
    const storedJobs = localStorage.getItem(this.workshopArchiveStorageKey);
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
            customerEmail: job.customerEmail || '',
            customerAddress: job.customerAddress || '',
            customerId: job.customerId || '',
            alternateContact: job.alternateContact || '',
            preferredContact: job.preferredContact || 'WhatsApp',
            vehicleMake: job.vehicleMake || '',
            vehicleModel: job.vehicleModel || '',
            vehicleYear: job.vehicleYear || '',
            engineNumber: job.engineNumber || '',
            vehicleColour: job.vehicleColour || '',
            fuelLevel: job.fuelLevel || '',
            keysReceived: job.keysReceived || '',
            accessoriesReceived: job.accessoriesReceived || '',
            diagnosticFee: Number(job.diagnosticFee) || 0,
            labourEstimate: Number(job.labourEstimate) || 0,
            partsEstimate: Number(job.partsEstimate) || 0,
            consumablesEstimate: Number(job.consumablesEstimate) || 0,
            vatEstimate: Number(job.vatEstimate) || 0,
            depositRequired: Number(job.depositRequired) || 0,
            paymentDate: job.paymentDate || '',
            bookingDate: job.bookingDate || (job.createdAt || this.toDateInputValue(new Date())).slice(0, 10),
            bookingTime: job.bookingTime || '',
            status: 'Collected',
            priority: job.priority || this.workshopPriorities[0],
            customerApproval: job.customerApproval || this.customerApprovalStatuses[0],
            approvalMethod: job.approvalMethod || '',
            vin: (job.vin || '').toUpperCase(),
            bookingType: job.bookingType || this.bookingTypes[0],
            mobileLocation: job.mobileLocation || '',
            assignedMechanic: job.assignedMechanic || '',
            partsNotes: job.partsNotes || '',
            qualityNotes: job.qualityNotes || '',
            notes: job.notes || '',
            inspection: this.normaliseWorkshopInspection(job.inspection),
            mileage: Math.max(Number(job.mileage) || 0, 0),
            nextServiceMileage: Math.max(Number(job.nextServiceMileage) || 0, 0),
            attachments: Array.isArray(job.attachments)
              ? job.attachments.filter(attachment => attachment && attachment.id && attachment.fileName)
              : [],
            archivedAt: job.archivedAt || job.updatedAt || new Date().toISOString()
          }));
      }
    } catch (error) {
      localStorage.removeItem(this.workshopArchiveStorageKey);
    }

    return [];
  }

  private saveArchivedWorkshopJobs(): void {
    localStorage.setItem(this.workshopArchiveStorageKey, JSON.stringify(this.archivedWorkshopJobs));
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
      customerEmail: '',
      customerAddress: '',
      customerId: '',
      alternateContact: '',
      preferredContact: 'WhatsApp',
      vehicle: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      registration: '',
      vin: '',
      engineNumber: '',
      vehicleColour: '',
      fuelLevel: '',
      keysReceived: '',
      accessoriesReceived: '',
      bookingType: 'Workshop booking',
      mobileLocation: '',
      assignedMechanic: '',
      jobType: '',
      status: 'Booked',
      priority: 'Normal',
      customerApproval: 'Not requested',
      approvalMethod: '',
      estimate: 0,
      diagnosticFee: 0,
      labourEstimate: 0,
      partsEstimate: 0,
      consumablesEstimate: 0,
      vatEstimate: 0,
      depositRequired: 0,
      paid: 0,
      paymentDate: '',
      bookingDate: this.toDateInputValue(new Date()),
      bookingTime: this.toTimeInputValue(new Date()),
      dueDate: '',
      mileage: 0,
      nextServiceMileage: 0,
      partsNotes: '',
      qualityNotes: '',
      notes: '',
      inspection: this.createEmptyWorkshopInspection(),
      attachments: []
    };
  }

  private createEmptyWorkshopInspection(): WorkshopInspection {
    const blankRow = (): InspectionRow => ({ status: '', notes: '' });
    const blankRows = (items: string[]): Record<string, InspectionRow> => Object.fromEntries(items.map(item => [item, blankRow()]));
    return {
      intake: blankRows([...this.intakeExteriorItems, ...this.intakeInteriorItems]),
      warningLights: [],
      existingDamage: '',
      safety: blankRows(this.safetyInspectionItems),
      underBonnet: blankRows(this.underBonnetItems),
      underVehicle: blankRows(this.underVehicleItems),
      tyres: Object.fromEntries(this.tyrePositions.map(position => [position, { status: '', tread: '', pressure: '', notes: '' }])),
      tyreActions: [],
      brakes: Object.fromEntries(this.brakePositions.map(position => [position, { status: '', pad: '', disc: '', notes: '' }])),
      recommendedWork: Array.from({ length: 4 }, () => ({ priority: '', repair: '', estimate: '', decision: '' })),
      finalQuality: []
    };
  }

  private normaliseWorkshopInspection(inspection?: Partial<WorkshopInspection>): WorkshopInspection {
    const defaults = this.createEmptyWorkshopInspection();
    const rows = (items: string[], stored?: Record<string, InspectionRow>) => Object.fromEntries(items.map(item => [item, {
      status: stored?.[item]?.status || '',
      notes: stored?.[item]?.notes || ''
    }]));
    return {
      intake: rows([...this.intakeExteriorItems, ...this.intakeInteriorItems], inspection?.intake),
      warningLights: Array.isArray(inspection?.warningLights) ? inspection!.warningLights : [],
      existingDamage: inspection?.existingDamage || '',
      safety: rows(this.safetyInspectionItems, inspection?.safety),
      underBonnet: rows(this.underBonnetItems, inspection?.underBonnet),
      underVehicle: rows(this.underVehicleItems, inspection?.underVehicle),
      tyres: Object.fromEntries(this.tyrePositions.map(position => [position, {
        status: inspection?.tyres?.[position]?.status || '',
        tread: inspection?.tyres?.[position]?.tread || '',
        pressure: inspection?.tyres?.[position]?.pressure || '',
        notes: inspection?.tyres?.[position]?.notes || ''
      }])),
      tyreActions: Array.isArray(inspection?.tyreActions) ? inspection!.tyreActions : [],
      brakes: Object.fromEntries(this.brakePositions.map(position => [position, {
        status: inspection?.brakes?.[position]?.status || '',
        pad: inspection?.brakes?.[position]?.pad || '',
        disc: inspection?.brakes?.[position]?.disc || '',
        notes: inspection?.brakes?.[position]?.notes || ''
      }])),
      recommendedWork: Array.from({ length: 4 }, (_, index) => ({
        priority: inspection?.recommendedWork?.[index]?.priority || '',
        repair: inspection?.recommendedWork?.[index]?.repair || '',
        estimate: inspection?.recommendedWork?.[index]?.estimate || '',
        decision: inspection?.recommendedWork?.[index]?.decision || ''
      })),
      finalQuality: Array.isArray(inspection?.finalQuality) ? inspection!.finalQuality : defaults.finalQuality
    };
  }

  toggleInspectionChoice(values: string[], value: string): string[] {
    return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  }

  toggleDelimitedField(field: 'preferredContact' | 'fuelLevel' | 'accessoriesReceived', value: string): void {
    const values = (this.workshopDraft[field] || '').split(',').map(item => item.trim()).filter(Boolean);
    this.workshopDraft[field] = this.toggleInspectionChoice(values, value).join(', ');
  }

  selectDelimitedField(field: 'fuelLevel', value: string): void {
    this.workshopDraft[field] = value;
  }

  fieldIncludes(field: 'preferredContact' | 'fuelLevel' | 'accessoriesReceived', value: string): boolean {
    return (this.workshopDraft[field] || '').split(',').map(item => item.trim()).includes(value);
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

  private calendarDateFromIso(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  private startOfWeek(date: Date): Date {
    const day = date.getDay() || 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + 1);
  }

  private toTimeInputValue(date: Date): string {
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  private buildShareMessage(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): string {
    const amountLine = documentType === 'Invoice'
      ? 'Invoice paid: R' + job.paid
      : 'Estimated amount: R' + job.estimate;
    return [
      "AB's Auto Mobile Mechanic (Pty) Ltd",
      documentType + ': ' + this.getJobReference(job),
      job.vehicle + (job.registration ? ' | ' + job.registration : ''),
      'Status: ' + job.status,
      amountLine,
      'The PDF job pack and evidence are attached.'
    ].join('\n');
  }

  private async createClientPdf(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): Promise<File> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
    const logoImage = await this.embedPdfAssetImage(document, '/assets/img/ab-auto-logo.png');
    const vehiclePhoto = job.attachments?.find(attachment => attachment.type === 'Vehicle photo' && attachment.srcImg);
    let vehicleImage: any = null;
    if (vehiclePhoto) {
      try {
        vehicleImage = await this.embedWorkshopAttachment(document, vehiclePhoto);
      } catch {
        vehicleImage = null;
      }
    }
    await this.buildDynamicWorkshopPack(document, job, documentType, font, boldFont, rgb, logoImage, vehicleImage);
    this.buildWorkshopTerms(document, font, boldFont, rgb, logoImage);

    /* Legacy fixed-template mapping retained for reference while all client packs use reflowing pages. */
    /*
    draw(this.getJobReference(job), 113, 753, 78, 6.2, true);
    draw(date, 299, 753, 73, 6.2);
    draw(job.bookingTime, 431, 753, 56, 6.2);
    draw(job.dueDate ? this.formatClientPdfDate(job.dueDate) : '', 113, 731, 78, 6.2);
    draw(job.assignedMechanic, 299, 731, 73, 6.2);
    draw(job.assignedMechanic, 431, 731, 56, 6.2);
    draw(job.customerName, 108, 680, 174);
    draw(job.customerId, 108, 661, 174);
    draw(job.customerContact, 108, 639, 174);
    draw(job.alternateContact, 108, 618, 174);
    draw(job.customerEmail, 108, 596, 174, 6.5);
    draw(job.customerAddress, 108, 575, 174, 6.5);
    mark(selected(job.preferredContact, 'Call'), 111, 554);
    mark(selected(job.preferredContact, 'WhatsApp'), 140, 554);
    mark(selected(job.preferredContact, 'SMS'), 193, 554);
    mark(selected(job.preferredContact, 'Email'), 227, 554);
    draw(job.vehicleMake || job.vehicle, 367, 680, 180);
    draw(job.vehicleModel, 367, 661, 180);
    draw(job.vehicleYear, 367, 639, 180);
    draw(job.registration, 367, 618, 180);
    draw(job.vin, 367, 596, 180, 6.1);
    draw(job.engineNumber, 367, 575, 180);
    draw(job.mileage ? job.mileage.toLocaleString('en-ZA') + ' km' : '', 367, 554, 180);
    draw(job.vehicleColour, 367, 536, 180);
    mark(job.fuelLevel === 'Empty', 374, 516);
    mark(job.fuelLevel === '1/4', 395, 516);
    mark(job.fuelLevel === '1/2', 412, 516);
    mark(job.fuelLevel === '3/4', 434, 516);
    mark(job.fuelLevel === 'Full', 456, 516);
    draw(job.keysReceived, 367, 497, 180);
    mark(selected(job.accessoriesReceived, 'Spare wheel'), 38, 461);
    mark(selected(job.accessoriesReceived, 'Jack'), 97, 461);
    mark(selected(job.accessoriesReceived, 'Wheel spanner'), 135, 461);
    mark(selected(job.accessoriesReceived, 'Locking wheel nut key'), 198, 461);
    mark(selected(job.accessoriesReceived, 'Service book'), 293, 461);
    mark(selected(job.accessoriesReceived, 'Radio code'), 355, 461);
    mark(selected(job.accessoriesReceived, 'Wheel caps'), 412, 461);
    const overflowNotes: Array<{ title: string; value: string }> = [];
    const requestedWork = job.notes || job.jobType;
    const findings = job.qualityNotes || job.partsNotes;
    this.drawBoundedPdfText(firstPage, requestedWork, 36, 425, 520, 7.2, font, 4, 'Requested work / customer complaint', overflowNotes);
    this.drawBoundedPdfText(firstPage, findings, 36, 328, 520, 7.2, font, 4, 'Technician findings / diagnosis', overflowNotes);
    draw(amount(job.diagnosticFee), 142, 248, 96);
    draw(amount(job.labourEstimate), 402, 248, 96);
    draw(amount(job.partsEstimate), 142, 227, 96);
    draw(amount(job.consumablesEstimate), 402, 227, 96);
    draw(amount(job.vatEstimate), 142, 206, 96);
    draw(amount(total), 402, 206, 96, 8, true);
    draw(amount(job.depositRequired), 142, 185, 96);
    draw(documentType === 'Invoice' ? amount(job.paid) : amount(balance), 402, 185, 96, 8, true);

    this.drawInspectionMarks(document, job, font, boldFont, overflowNotes);
    this.appendOverflowNotes(document, overflowNotes, font, boldFont);
    */

    await this.appendPdfEvidence(document, job, font, boldFont, rgb, logoImage);
    this.addPdfBrandFooters(document, logoImage, font, rgb);
    const bytes = await document.save();
    const safeReference = this.getJobReference(job).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    const fileBytes = new Uint8Array(bytes.length);
    fileBytes.set(bytes);
    return new File([fileBytes.buffer], safeReference + '-' + documentType.toLowerCase().replace(' ', '-') + '.pdf', { type: 'application/pdf' });
  }

  private async buildDynamicWorkshopPack(document: any, job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice', font: any, boldFont: any, rgb: any, logoImage: any, vehicleImage: any): Promise<void> {
    const red = rgb(0.55, 0.04, 0.08);
    const dark = rgb(0.09, 0.12, 0.15);
    const pale = rgb(0.94, 0.95, 0.96);
    const white = rgb(1, 1, 1);
    const green = rgb(0.16, 0.58, 0.31);
    const amber = rgb(0.96, 0.68, 0.12);
    const urgent = rgb(0.86, 0.11, 0.14);
    const grey = rgb(0.82, 0.84, 0.86);
    const inspection = this.normaliseWorkshopInspection(job.inspection);
    const pageSize: [number, number] = [595.28, 841.89];
    let page: any;
    let y = 0;
    let currentTitle = '';
    let currentSubtitle = '';
    const startPage = (title: string, subtitle: string, continuation = false) => {
      currentTitle = title;
      currentSubtitle = subtitle;
      page = document.addPage(pageSize);
      this.drawWorkshopPdfHeader(page, title, continuation ? subtitle + ' (continued)' : subtitle, logoImage, font, boldFont, rgb);
      y = 700;
    };
    const ensure = (height: number) => {
      if (y - height < 52) {
        startPage(currentTitle, currentSubtitle, true);
      }
    };
    const section = (label: string) => {
      ensure(36);
      page.drawRectangle({ x: 45, y: y - 20, width: 505, height: 20, color: red });
      page.drawText(label, { x: 52, y: y - 14, size: 10, font: boldFont, color: white });
      y -= 34;
    };
    const paragraph = (label: string, value: string) => {
      const lines = this.wrapPdfText(value || 'Not recorded.', 488, 9, font);
      ensure(18 + lines.length * 12);
      page.drawText(label, { x: 45, y, size: 9.5, font: boldFont, color: dark });
      y -= 13;
      lines.forEach(line => { page.drawText(line, { x: 52, y, size: 9, font, color: dark }); y -= 12; });
      y -= 8;
    };
    const statusStyle = (value: string) => {
      const statusValue = value.toUpperCase();
      if (['OK', 'G', 'CHECKED'].includes(statusValue)) return { fill: green, text: white };
      if (['ATTN', 'A'].includes(statusValue)) return { fill: amber, text: dark };
      if (['URG', 'U', 'D', 'DAMAGED'].includes(statusValue)) return { fill: urgent, text: white };
      return { fill: grey, text: dark };
    };
    const table = (headers: string[], rows: string[][], widths: number[]) => {
      const x = 45;
      const drawRow = (cells: string[], header = false) => {
        const lines = cells.map((cell, index) => this.wrapPdfText(cell || '', widths[index] - 8, header ? 8.3 : 8, header ? boldFont : font));
        const height = Math.max(22, ...lines.map(linesForCell => linesForCell.length * 10 + 10));
        ensure(height + (header ? 22 : 0));
        let cursor = x;
        cells.forEach((_, index) => {
          const isStatus = ['Condition', 'Status', 'Result'].includes(headers[index]);
          const style = !header && isStatus ? statusStyle(cells[index]) : { fill: header ? pale : white, text: dark };
          page.drawRectangle({ x: cursor, y: y - height, width: widths[index], height, color: style.fill, borderColor: rgb(0.72, 0.75, 0.77), borderWidth: .5 });
          lines[index].forEach((line, lineIndex) => page.drawText(line, { x: cursor + 4, y: y - 13 - lineIndex * 10, size: header ? 8.3 : 8, font: header ? boldFont : font, color: style.text }));
          cursor += widths[index];
        });
        y -= height;
      };
      if (headers.length) {
        drawRow(headers, true);
      }
      rows.forEach(row => drawRow(row));
      y -= 10;
    };
    const status = (value: string) => value || 'N/C';
    const money = (value: number) => value ? 'R ' + Number(value).toFixed(2) : 'R 0.00';
    const inspectionLegend = () => {
      ensure(31);
      const legend = [
        ['OK - Checked and satisfactory', green, white],
        ['ATTN - May require attention', amber, dark],
        ['URG - Immediate attention', urgent, white],
        ['N/C - Not checked', grey, dark]
      ];
      const width = 505 / legend.length;
      legend.forEach(([label, color, textColor], index) => {
        page.drawRectangle({ x: 45 + index * width, y: y - 22, width, height: 22, color });
        page.drawText(label as string, { x: 50 + index * width, y: y - 14, size: 6.7, font: boldFont, color: textColor });
      });
      y -= 29;
    };
    const vehicleRecord = () => {
      ensure(106);
      page.drawRectangle({ x: 45, y: y - 96, width: 505, height: 96, color: pale, borderColor: rgb(0.72, 0.75, 0.77), borderWidth: .5 });
      page.drawText('VEHICLE RECORD', { x: 56, y: y - 17, size: 9.5, font: boldFont, color: red });
      page.drawText((job.vehicleMake || job.vehicle) + ' ' + (job.vehicleModel || ''), { x: 56, y: y - 38, size: 12, font: boldFont, color: dark });
      page.drawText('Registration: ' + (job.registration || 'Not recorded'), { x: 56, y: y - 55, size: 8.5, font, color: dark });
      page.drawText('Mileage: ' + (job.mileage ? job.mileage.toLocaleString('en-ZA') + ' km' : 'Not recorded'), { x: 56, y: y - 70, size: 8.5, font, color: dark });
      page.drawText('Next estimated service: ' + (job.nextServiceMileage ? job.nextServiceMileage.toLocaleString('en-ZA') + ' km' : 'Not recorded'), { x: 56, y: y - 85, size: 8.5, font, color: dark });
      if (vehicleImage) {
        const scale = Math.min(145 / vehicleImage.width, 78 / vehicleImage.height);
        const width = vehicleImage.width * scale;
        const height = vehicleImage.height * scale;
        page.drawRectangle({ x: 392, y: y - 87, width: 145, height: 78, color: white, borderColor: grey, borderWidth: .5 });
        page.drawImage(vehicleImage, { x: 392 + (145 - width) / 2, y: y - 87 + (78 - height) / 2, width, height });
      } else {
        page.drawText('No vehicle photo recorded', { x: 401, y: y - 50, size: 8, font, color: dark });
      }
      y -= 106;
    };

    startPage('JOB DETAILS AND VEHICLE INFORMATION', 'CUSTOMER JOB CARD');
    section('JOB DETAILS');
    table(['Job card number', 'Date in', 'Time in', 'Estimated completion', 'Technician'], [[
      this.getJobReference(job), this.formatClientPdfDate(job.bookingDate), job.bookingTime || 'To confirm',
      job.dueDate ? this.formatClientPdfDate(job.dueDate) : 'To confirm', job.assignedMechanic || 'Not assigned'
    ]], [105, 95, 72, 125, 108]);
    vehicleRecord();
    section('CUSTOMER AND VEHICLE DETAILS');
    table(['Customer detail', 'Value', 'Vehicle detail', 'Value'], [
      ['Customer name', job.customerName, 'Make', job.vehicleMake || job.vehicle],
      ['Cell number', job.customerContact, 'Model', job.vehicleModel],
      ['Alternative number', job.alternateContact, 'Year', job.vehicleYear],
      ['Email', job.customerEmail, 'Registration number', job.registration],
      ['Address', job.customerAddress, 'VIN / chassis number', job.vin],
      ['Preferred contact', job.preferredContact, 'Engine number', job.engineNumber],
      ['Mileage', job.mileage ? job.mileage.toLocaleString('en-ZA') + ' km' : 'Not recorded', 'Fuel / keys', [job.fuelLevel, job.keysReceived].filter(Boolean).join(' | ')],
      ['Next estimated service', job.nextServiceMileage ? job.nextServiceMileage.toLocaleString('en-ZA') + ' km' : 'Not recorded', 'Accessories received', job.accessoriesReceived]
    ], [105, 148, 105, 147]);
    section('REQUESTED WORK / CUSTOMER COMPLAINT');
    paragraph('Customer request', job.notes || job.jobType);
    section('TECHNICIAN FINDINGS / DIAGNOSIS');
    paragraph('Findings', job.qualityNotes || job.partsNotes);

    startPage('QUOTATION AND AUTHORISATION', 'CUSTOMER JOB CARD');
    section('QUOTATION SUMMARY');
    table(['Diagnostic fee', 'Labour', 'Parts', 'Consumables'], [[money(job.diagnosticFee), money(job.labourEstimate), money(job.partsEstimate), money(job.consumablesEstimate)]], [126, 126, 126, 127]);
    table(['VAT', 'Total estimate', 'Deposit required', documentType === 'Invoice' ? 'Invoice paid' : 'Balance due'], [[money(job.vatEstimate), money(job.estimate), money(job.depositRequired), money(documentType === 'Invoice' ? job.paid : Math.max(job.estimate - job.paid, 0))]], [126, 126, 126, 127]);
    section('CUSTOMER AUTHORISATION');
    paragraph('Authorisation', 'The customer authorises the recorded inspection, diagnosis and approved repair work. Approval method: ' + (job.approvalMethod || 'Not recorded') + '.');

    startPage('VEHICLE INTAKE CONDITION', 'VEHICLE INSPECTION AND QUALITY CHECKLIST');
    inspectionLegend();
    section('A. VEHICLE INTAKE CONDITION - EXTERIOR');
    table(['Item', 'Condition', 'Notes'], this.intakeExteriorItems.map(item => [item, status(inspection.intake[item]?.status), inspection.intake[item]?.notes || '']), [205, 80, 220]);
    section('A. VEHICLE INTAKE CONDITION - INTERIOR');
    table(['Item', 'Condition', 'Notes'], this.intakeInteriorItems.map(item => [item, status(inspection.intake[item]?.status), inspection.intake[item]?.notes || '']), [205, 80, 220]);
    section('B. DASHBOARD WARNING LIGHTS');
    paragraph('Warning lights recorded', inspection.warningLights.join(', ') || 'None recorded.');
    section('C. EXISTING DAMAGE NOTES');
    paragraph('Damage at intake', inspection.existingDamage);

    startPage('DETAILED MECHANICAL AND SAFETY INSPECTION', 'VEHICLE INSPECTION AND QUALITY CHECKLIST');
    inspectionLegend();
    const inspectionTable = (title: string, items: string[], rows: Record<string, InspectionRow>) => {
      section(title);
      table(['Inspection item', 'Status', 'Notes / measurements'], items.map(item => [item, status(rows[item]?.status), rows[item]?.notes || '']), [245, 80, 180]);
    };
    inspectionTable('E. SAFETY AND OPERATIONAL CHECKS', this.safetyInspectionItems, inspection.safety);
    inspectionTable('F. UNDER-BONNET CHECKS', this.underBonnetItems, inspection.underBonnet);
    inspectionTable('G. UNDER-VEHICLE CHECKS', this.underVehicleItems, inspection.underVehicle);

    startPage('TYRES, BRAKES AND RECOMMENDATIONS', 'VEHICLE INSPECTION AND QUALITY CHECKLIST');
    inspectionLegend();
    section('H. TYRE CONDITION AND MEASUREMENTS');
    table(['Position', 'Status', 'Tread (mm)', 'Pressure (kPa)', 'Wear / recommendation'], this.tyrePositions.map(position => {
      const row = inspection.tyres[position];
      return [position, status(row?.status), row?.tread || '', row?.pressure || '', row?.notes || ''];
    }), [65, 70, 105, 105, 160]);
    paragraph('Suggested tyre action', inspection.tyreActions.join(', ') || 'None recorded.');
    section('I. BRAKE CONDITION AND MEASUREMENTS');
    table(['Position', 'Status', 'Pad / shoe (mm)', 'Disc / drum condition', 'Notes / recommendation'], this.brakePositions.map(position => {
      const row = inspection.brakes[position];
      return [position, status(row?.status), row?.pad || '', row?.disc || '', row?.notes || ''];
    }), [65, 70, 105, 130, 135]);
    section('J. FINDINGS AND RECOMMENDED WORK');
    table(['Priority', 'Recommended repair / action', 'Estimate / reference', 'Customer decision'], inspection.recommendedWork.map(row => [row.priority, row.repair, row.estimate, row.decision]), [85, 210, 105, 105]);
    section('K. FINAL QUALITY CONTROL');
    table(['Quality check', 'Result'], this.finalQualityItems.map(item => [item, inspection.finalQuality.includes(item) ? 'Checked' : 'Not checked']), [350, 155]);
  }

  private drawWorkshopPdfHeader(page: any, title: string, subtitle: string, logoImage: any, font: any, boldFont: any, rgb: any): void {
    const dark = rgb(0.09, 0.12, 0.15);
    const pale = rgb(0.94, 0.95, 0.96);
    const grey = rgb(0.82, 0.84, 0.86);
    const red = rgb(0.55, 0.04, 0.08);
    page.drawRectangle({ x: 35, y: 770, width: 42, height: 42, color: pale });
    if (logoImage) {
      const scale = Math.min(42 / logoImage.width, 42 / logoImage.height);
      page.drawImage(logoImage, { x: 35 + (42 - logoImage.width * scale) / 2, y: 770 + (42 - logoImage.height * scale) / 2, width: logoImage.width * scale, height: logoImage.height * scale });
    }
    page.drawText("AB's Auto Mobile Mechanic (Pty) Ltd", { x: 345, y: 806, size: 9.5, font: boldFont, color: dark });
    page.drawText(subtitle.toUpperCase(), { x: Math.max(235, 550 - boldFont.widthOfTextAtSize(subtitle.toUpperCase(), 8.8)), y: 791, size: 8.8, font: boldFont, color: red });
    page.drawLine({ start: { x: 18, y: 755 }, end: { x: 577, y: 755 }, thickness: 1.4, color: red });
    page.drawText(title, { x: 18, y: 731, size: 17, font: boldFont, color: dark });
  }

  private buildWorkshopTerms(document: any, font: any, boldFont: any, rgb: any, logoImage: any): void {
    const dark = rgb(0.09, 0.12, 0.15);
    const red = rgb(0.55, 0.04, 0.08);
    const grey = rgb(0.94, 0.95, 0.96);
    const storageFee = 'R ' + this.storageFee.toFixed(2) + ' per day';
    const termsPage = (continued: boolean) => {
      const page = document.addPage([595.28, 841.89]);
      if (logoImage) {
        const scale = Math.min(34 / logoImage.width, 34 / logoImage.height);
        page.drawImage(logoImage, { x: 45 + (34 - logoImage.width * scale) / 2, y: 792 + (34 - logoImage.height * scale) / 2, width: logoImage.width * scale, height: logoImage.height * scale });
      }
      page.drawText("AB's Auto Mobile Mechanic (Pty) Ltd", { x: 409, y: 816, size: 8, font: boldFont, color: dark });
      page.drawText('WORKSHOP TERMS AND CONDITIONS', { x: 400, y: 804, size: 8, font: boldFont, color: red });
      page.drawLine({ start: { x: 35, y: 781 }, end: { x: 560, y: 781 }, thickness: 1.3, color: red });
      if (continued) {
        page.drawText('WORKSHOP TERMS AND CONDITIONS - CONTINUED', { x: 38, y: 763, size: 8.6, font: boldFont, color: red });
      } else {
        page.drawText("AB's Auto Mobile Mechanic (Pty) Ltd", { x: 38, y: 763, size: 15.5, font: boldFont, color: dark });
        page.drawText('Workshop Terms and Conditions', { x: 38, y: 746, size: 15.5, font: boldFont, color: dark });
        page.drawText('Vehicle repairs, test drives, call-outs and workshop terms', { x: 38, y: 730, size: 8.2, font, color: dark });
        page.drawText('|  AB-AMM-P001', { x: 287, y: 730, size: 8.2, font: boldFont, color: red });
        page.drawRectangle({ x: 35, y: 689, width: 525, height: 34, color: grey, borderColor: rgb(0.78, 0.8, 0.82), borderWidth: .4 });
        const intro = this.wrapPdfText("These terms apply to diagnostics, servicing, repairs, mobile call-outs and workshop work carried out by AB's Auto Mobile Mechanic (Pty) Ltd.", 510, 8.2, font);
        intro.forEach((line, index) => page.drawText(line, { x: 40, y: 710 - index * 10, size: 8.2, font, color: dark }));
      }
      return { page, y: continued ? 741 : 672 };
    };
    const drawTerms = (page: any, startY: number, terms: Array<[string, string[]]>) => {
      let y = startY;
      terms.forEach(([heading, paragraphs]) => {
        page.drawText(heading, { x: 38, y, size: 8.9, font: boldFont, color: red });
        y -= 11;
        paragraphs.forEach(paragraph => {
          const lines = this.wrapPdfText(paragraph, 512, 8.1, font);
          lines.forEach(line => { page.drawText(line, { x: 38, y, size: 8.1, font, color: dark }); y -= 9.5; });
          y -= 2;
        });
        y -= 4;
      });
      return y;
    };
    const first = termsPage(false);
    drawTerms(first.page, first.y, [
      ['1. Quotes, estimates and authorisation', ['All prices given before work begins are estimates unless confirmed in writing as a final quote. If the expected cost changes after inspection or diagnosis, AB\'s Auto Mobile Mechanic (Pty) Ltd will contact the customer for approval before continuing.', 'No additional work, parts or labour will be carried out without customer approval. Approval may be given by signature, telephone, SMS, WhatsApp, email, written instruction or verbal instruction, and has the same effect as signed authorisation.']],
      ['2. Diagnostics and inspection', ['A diagnostic, inspection or call-out fee may apply and will be communicated before the work is carried out. Any mobile call-out fee will be agreed with the customer before AB\'s Auto Mobile Mechanic (Pty) Ltd travels to the vehicle location.', 'Some faults may only become visible after further testing, dismantling or repair work.']],
      ['3. Customer and vehicle information', ['The customer must provide accurate vehicle details, including make, model, year, licence number, VIN/chassis number where required, known faults and previous repair history. AB\'s Auto Mobile Mechanic (Pty) Ltd is not responsible for delays or incorrect diagnosis caused by missing or incorrect information supplied by the customer.']],
      ['4. Payment terms', ['Payment is due upon completion of the agreed work and before release of the vehicle, keys or parts, unless otherwise agreed in writing. Vehicles, keys or parts may be retained until the outstanding balance is paid in full.', 'Any parts ordered specially for a customer may require a deposit before work begins.']],
      ['5. Collection and storage', ['Customers must collect their vehicle within the agreed time after being notified that the work is complete. Storage is charged at ' + storageFee + ' if a vehicle is not collected within 2 days after completion notice, unless another collection arrangement is agreed in writing.', 'Vehicles left for an extended period without communication may be dealt with in accordance with applicable South African law after reasonable attempts have been made to contact the owner.']],
      ['6. Replaced parts', ['Where practical, replaced parts removed from the vehicle may be returned to the customer on request, unless the customer waives this right, the part is subject to a warranty/core exchange claim, insurance requirement, or safe/environmental disposal is required.']],
      ['7. Warranty on workmanship and parts', ['Workmanship and supplied parts are covered in line with applicable South African consumer protection laws. New or reconditioned parts may carry supplier or manufacturer warranties. Warranty claims are subject to inspection and confirmation of the fault.', 'Warranty does not apply where failure is caused by misuse, neglect, overheating, lack of maintenance, accident damage, unauthorised modifications, racing, incorrect fluids, customer-supplied parts, or work carried out by another person after the repair.']],
      ['8. Customer-supplied parts', ['Where a customer supplies their own parts, AB\'s Auto Mobile Mechanic (Pty) Ltd may fit them at the customer\'s request, but cannot guarantee the quality, suitability or lifespan of those parts. Workmanship on fitting may be assessed separately, but faults caused by defective or incorrect customer-supplied parts are not covered.']]
    ]);
    const second = termsPage(true);
    let y = drawTerms(second.page, second.y, [
      ['9. Mobile call-outs', ['Mobile mechanic services are subject to availability, travel distance, weather, safety, parts availability and access to a suitable working area. The call-out fee will be agreed with the customer before travelling to the vehicle location.', 'The call-out fee may still be payable where the mechanic travels to the agreed location, even if the vehicle cannot be repaired on-site due to safety, access, missing parts, incorrect information, or faults requiring workshop equipment. If a vehicle cannot be repaired safely or properly on-site, it may need to be moved to the workshop or another suitable repair location.']],
      ['10. Test drives', ['The customer authorises AB\'s Auto Mobile Mechanic (Pty) Ltd, its mechanic or authorised driver to test drive the vehicle where reasonably required for diagnosis, repair verification, road-safety checks or quality control.', 'Test drives will be carried out with reasonable care and only for work-related purposes. The business is not responsible for pre-existing faults, intermittent faults, wear-and-tear failures, or issues that arise during a test drive because of the vehicle\'s existing condition.']],
      ['11. Photos and service records', ['The customer authorises AB\'s Auto Mobile Mechanic (Pty) Ltd to photograph the vehicle, damaged components, replaced parts and completed repairs for quality control, insurance, warranty, quotations and service records.']],
      ['12. Delays and completion dates', ['Estimated completion dates are estimates only. AB\'s Auto Mobile Mechanic (Pty) Ltd is not responsible for delays caused by supplier delays, courier delays, weather, power failures, parts availability, additional faults discovered, or circumstances outside the workshop\'s reasonable control.']],
      ['13. Safety and lawful repairs', ['AB\'s Auto Mobile Mechanic (Pty) Ltd reserves the right to refuse or stop repairs where the work, requested instruction, vehicle condition or repair method would be unsafe, unlawful or unsuitable for responsible road use.']],
      ['14. Limitation of liability', ['AB\'s Auto Mobile Mechanic (Pty) Ltd will take reasonable care when working on a customer\'s vehicle. The business is not responsible for pre-existing faults, hidden damage, wear-and-tear issues, unrelated failures, or faults that occur after repair due to misuse, lack of maintenance or third-party work.']]
    ]);
    second.page.drawRectangle({ x: 35, y: y - 25, width: 525, height: 31, borderColor: red, borderWidth: .8 });
    this.wrapPdfText('Nothing in these Terms and Conditions excludes or limits any right or liability that may not lawfully be excluded under South African law.', 510, 8.2, boldFont)
      .forEach((line, index) => second.page.drawText(line, { x: 40, y: y - 10 - index * 10, size: 8.2, font: boldFont, color: dark }));
    y -= 39;
    y = drawTerms(second.page, y, [
      ['15. Disputes and acceptance', ['AB\'s Auto Mobile Mechanic (Pty) Ltd aims to resolve concerns fairly and directly. If a matter cannot be resolved, customers may approach the Motor Industry Ombudsman of South Africa where applicable.', 'By booking a service, approving a quote, leaving a vehicle for repair, accepting mobile call-out assistance, authorising a test drive, or authorising work by phone, WhatsApp, email or in person, the customer accepts these Terms and Conditions.', 'These Terms and Conditions support clear communication between AB\'s Auto Mobile Mechanic (Pty) Ltd and its customers and do not remove any rights or responsibilities applying under South African law.']]
    ]);
    second.page.drawText('CUSTOMER ACKNOWLEDGEMENT', { x: 38, y, size: 9, font: boldFont, color: red });
    y -= 11;
    const columns = [70, 140, 52, 95, 70, 138];
    const labels = ['Customer Name', '', 'Signature', '', 'Date', ''];
    let x = 35;
    columns.forEach((width, index) => {
      second.page.drawRectangle({ x, y: y - 30, width, height: 30, color: grey, borderColor: rgb(0.72, 0.75, 0.77), borderWidth: .5 });
      if (labels[index]) {
        const labelLines = this.wrapPdfText(labels[index], width - 7, 6.7, boldFont);
        labelLines.forEach((line, lineIndex) => second.page.drawText(line, { x: x + 4, y: y - 12 - lineIndex * 8, size: 6.7, font: boldFont, color: dark }));
      }
      x += width;
    });
  }

  private drawInspectionMarks(document: any, job: WorkshopJob, font: any, boldFont: any, overflowNotes: Array<{ title: string; value: string }>): void {
    const inspection = this.normaliseWorkshopInspection(job.inspection);
    const mark = (page: any, active: boolean, x: number, y: number) => {
      if (active) {
        page.drawText('X', { x, y, size: 6.2, font: boldFont });
      }
    };
    const value = (page: any, text: string, x: number, y: number, width: number, size = 6.4, title = '') => title
      ? this.drawBoundedPdfText(page, text, x, y, width, size, font, 1, title, overflowNotes)
      : this.drawPdfText(page, text, x, y, width, size, font);
    const pageTwo = document.getPage(1);
    value(pageTwo, this.getJobReference(job), 70, 740, 90);
    value(pageTwo, job.customerName, 212, 740, 85);
    value(pageTwo, job.vehicle, 350, 740, 110);
    value(pageTwo, job.registration, 477, 740, 70);
    value(pageTwo, job.mileage ? job.mileage.toLocaleString('en-ZA') : '', 70, 710, 90);
    value(pageTwo, job.bookingDate ? this.formatClientPdfDate(job.bookingDate) : '', 212, 710, 85);
    value(pageTwo, job.assignedMechanic, 350, 710, 195);
    this.intakeExteriorItems.forEach((item, index) => {
      const status = inspection.intake[item]?.status;
      const y = 639 - index * 17.1;
      mark(pageTwo, status === 'G', 132, y);
      mark(pageTwo, status === 'D', 156, y);
      mark(pageTwo, status === 'N/C', 187, y);
      value(pageTwo, inspection.intake[item]?.notes || '', 207, y, 75, 6, 'Vehicle intake - ' + item);
    });
    this.intakeInteriorItems.forEach((item, index) => {
      const status = inspection.intake[item]?.status;
      const y = 625 - index * 17.1;
      mark(pageTwo, status === 'G', 394, y);
      mark(pageTwo, status === 'D', 418, y);
      mark(pageTwo, status === 'N/C', 449, y);
      value(pageTwo, inspection.intake[item]?.notes || '', 470, y, 75, 6, 'Vehicle intake - ' + item);
    });
    const warningLightXs = [38, 99, 129, 166, 221, 260, 319, 354, 404];
    this.dashboardWarningItems.forEach((item, index) => mark(pageTwo, inspection.warningLights.includes(item), warningLightXs[index], 367));
    this.drawBoundedPdfText(pageTwo, inspection.existingDamage, 36, 337, 520, 7, font, 5, 'Existing damage notes', overflowNotes);

    const pageThree = document.getPage(2);
    const drawDetailedRows = (items: string[], rows: Record<string, InspectionRow>, startY: number) => items.forEach((item, index) => {
      const row = rows[item];
      const y = startY - index * 17.1;
      mark(pageThree, row?.status === 'OK', 193, y);
      mark(pageThree, row?.status === 'ATTN', 225, y);
      mark(pageThree, row?.status === 'URG', 258, y);
      mark(pageThree, row?.status === 'N/C', 291, y);
      value(pageThree, row?.notes || '', 309, y, 230, 6, 'Inspection - ' + item);
    });
    drawDetailedRows(this.safetyInspectionItems, inspection.safety, 613);
    drawDetailedRows(this.underBonnetItems, inspection.underBonnet, 421);
    drawDetailedRows(this.underVehicleItems, inspection.underVehicle, 179);

    const pageFour = document.getPage(3);
    this.tyrePositions.forEach((position, index) => {
      const row = inspection.tyres[position];
      const y = 600 - index * 20.2;
      mark(pageFour, row?.status === 'OK', 88, y);
      mark(pageFour, row?.status === 'A', 108, y);
      mark(pageFour, row?.status === 'U', 128, y);
      mark(pageFour, row?.status === 'N/C', 144, y);
      value(pageFour, row?.tread || '', 199, y, 70);
      value(pageFour, row?.pressure || '', 288, y, 55);
      value(pageFour, row?.notes || '', 359, y, 180, 6.4, 'Tyre - ' + position);
    });
    this.brakePositions.forEach((position, index) => {
      const row = inspection.brakes[position];
      const y = 431 - index * 20.2;
      mark(pageFour, row?.status === 'OK', 88, y);
      mark(pageFour, row?.status === 'A', 108, y);
      mark(pageFour, row?.status === 'U', 128, y);
      mark(pageFour, row?.status === 'N/C', 144, y);
      value(pageFour, row?.pad || '', 199, y, 55);
      value(pageFour, row?.disc || '', 261, y, 110);
      value(pageFour, row?.notes || '', 386, y, 150, 6.4, 'Brake - ' + position);
    });
    inspection.recommendedWork.forEach((row, index) => {
      const y = 329 - index * 20.2;
      value(pageFour, row.priority, 21, y, 95, 6);
      value(pageFour, row.repair, 127, y, 205, 6);
      value(pageFour, row.estimate, 347, y, 70, 6);
      value(pageFour, row.decision, 427, y, 110, 6);
    });
    this.finalQualityItems.forEach((item, index) => {
      const row = Math.floor(index / 2);
      mark(pageFour, inspection.finalQuality.includes(item), index % 2 ? 300 : 38, 240 - row * 16.8);
    });
  }

  private async appendPdfEvidence(document: any, job: WorkshopJob, font: any, boldFont: any, rgb: any, logoImage: any): Promise<void> {
    const attachments = job.attachments || [];
    const imageAttachments = attachments.filter(attachment => attachment.mimeType.startsWith('image/') && attachment.srcImg);
    const fileAttachments = attachments.filter(attachment => !attachment.mimeType.startsWith('image/'));
    if (!attachments.length) {
      return;
    }
    let page = document.addPage([595.28, 841.89]);
    this.drawWorkshopPdfHeader(page, 'SUPPORTING PHOTOS AND DOCUMENTS', 'JOB CARD EVIDENCE', logoImage, font, boldFont, rgb);
    let y = 700;
    this.drawPdfText(page, this.getJobReference(job) + ' | ' + job.customerName + ' | ' + job.vehicle, 45, y, 500, 9, font);
    y -= 30;
    this.drawPdfText(page, 'Vehicle photos, supplier parts slips and payment records attached to this job.', 45, y, 500, 8.5, font);
    y -= 28;
    if (fileAttachments.length) {
      this.drawPdfText(page, 'Files recorded', 45, y, 500, 10, boldFont);
      y -= 17;
      fileAttachments.forEach(attachment => {
        this.drawPdfText(page, attachment.type + ': ' + attachment.fileName, 55, y, 475, 8, font);
        y -= 15;
      });
    }
    if (!imageAttachments.length) {
      this.drawPdfText(page, 'No image evidence was attached to this job card.', 45, y - 8, 500, 9, font);
      return;
    }
    for (const attachment of imageAttachments) {
      try {
        const embedded = await this.embedWorkshopAttachment(document, attachment);
        if (!embedded) {
          continue;
        }
        page = document.addPage([595.28, 841.89]);
        this.drawWorkshopPdfHeader(page, attachment.type + ': ' + attachment.fileName, 'JOB CARD EVIDENCE', logoImage, font, boldFont, rgb);
        const maxWidth = 500;
        const maxHeight = 680;
        const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height, 1);
        const width = embedded.width * scale;
        const height = embedded.height * scale;
        page.drawImage(embedded, { x: (595.28 - width) / 2, y: 55, width, height });
      } catch {
        page = document.addPage([595.28, 841.89]);
        this.drawWorkshopPdfHeader(page, attachment.type + ': ' + attachment.fileName, 'JOB CARD EVIDENCE', logoImage, font, boldFont, rgb);
        this.drawPdfText(page, 'This image could not be embedded. The original file remains on the secure job card.', 45, 690, 500, 9, font);
      }
    }
  }

  private async embedPdfAssetImage(document: any, url: string): Promise<any | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const bytes = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || '';
      return contentType.includes('png') || url.toLowerCase().endsWith('.png')
        ? document.embedPng(bytes)
        : document.embedJpg(bytes);
    } catch {
      return null;
    }
  }

  private addPdfBrandFooters(document: any, logoImage: any, font: any, rgb: any): void {
    const pages = document.getPages();
    const dark = rgb(0.09, 0.12, 0.15);
    pages.forEach((page: any, index: number) => {
      const { width } = page.getSize();
      page.drawLine({ start: { x: 45, y: 31 }, end: { x: width - 45, y: 31 }, thickness: .4, color: rgb(0.78, 0.8, 0.82) });
      if (logoImage) {
        const scale = Math.min(18 / logoImage.width, 15 / logoImage.height);
        page.drawImage(logoImage, { x: 45, y: 11, width: logoImage.width * scale, height: logoImage.height * scale });
      }
      page.drawText("AB's Auto Mobile Mechanic (Pty) Ltd", { x: 67, y: 17, size: 6.5, font, color: dark });
      page.drawText('Page ' + (index + 1) + ' of ' + pages.length, { x: width - 88, y: 17, size: 6.5, font, color: dark });
    });
  }

  private async embedWorkshopAttachment(document: any, attachment: WorkshopAttachment) {
    const response = await fetch(attachment.srcImg);
    if (!response.ok) {
      return null;
    }
    const bytes = await response.arrayBuffer();
    if (attachment.mimeType === 'image/png') {
      return document.embedPng(bytes);
    }
    if (attachment.mimeType === 'image/jpeg' || attachment.mimeType === 'image/jpg') {
      return document.embedJpg(bytes);
    }
    const converted = await this.convertImageToPng(new Blob([bytes], { type: attachment.mimeType }));
    return document.embedPng(converted);
  }

  private async convertImageToPng(blob: Blob): Promise<ArrayBuffer> {
    const source = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      return await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer();
    } finally {
      URL.revokeObjectURL(source);
    }
  }

  private drawBoundedPdfText(page: any, value: string, x: number, y: number, width: number, size: number, font: any, maxLines: number, title: string, overflowNotes: Array<{ title: string; value: string }>): void {
    const lines = this.wrapPdfText(value, width, size, font);
    lines.slice(0, maxLines).forEach((item, index) => page.drawText(item, { x, y: y - index * (size + 2), size, font }));
    if (lines.length > maxLines) {
      overflowNotes.push({ title, value: lines.slice(maxLines).join(' ') });
    }
  }

  private appendOverflowNotes(document: any, notes: Array<{ title: string; value: string }>, font: any, boldFont: any): void {
    const remaining = notes.filter(note => note.value.trim());
    if (!remaining.length) {
      return;
    }
    let page = document.addPage([595.28, 841.89]);
    let y = 795;
    const newPage = () => {
      page = document.addPage([595.28, 841.89]);
      y = 795;
    };
    this.drawPdfText(page, 'ADDITIONAL JOB CARD NOTES', 45, y, 500, 15, boldFont);
    y -= 26;
    this.drawPdfText(page, 'Continued notes from the completed job card and inspection checklist.', 45, y, 500, 8.5, font);
    y -= 27;
    remaining.forEach(note => {
      const lines = this.wrapPdfText(note.value, 500, 8.5, font);
      const requiredHeight = 18 + lines.length * 12;
      if (y - requiredHeight < 45) {
        newPage();
        this.drawPdfText(page, 'ADDITIONAL JOB CARD NOTES', 45, y, 500, 15, boldFont);
        y -= 28;
      }
      this.drawPdfText(page, note.title, 45, y, 500, 9.5, boldFont);
      y -= 14;
      lines.forEach(line => {
        page.drawText(line, { x: 45, y, size: 8.5, font });
        y -= 12;
      });
      y -= 8;
    });
  }

  private wrapPdfText(value: string, width: number, size: number, font: any): string[] {
    const words = (value || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(candidate, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      lines.push(line);
    }
    return lines;
  }

  private drawPdfText(page: any, value: string, x: number, y: number, width: number, size: number, font: any, maxLines = 1): void {
    const lines = this.wrapPdfText(value, width, size, font);
    lines.slice(0, maxLines).forEach((item, index) => page.drawText(item, { x, y: y - index * (size + 2), size, font }));
  }

  private formatClientPdfDate(value: string): string {
    return this.calendarDateFromIso(value).toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private clearClientPdfPreview(): void {
    if (this.clientPdfObjectUrl) {
      URL.revokeObjectURL(this.clientPdfObjectUrl);
    }
    this.clientPdfObjectUrl = '';
    this.clientPdfPreviewUrl = null;
    this.clientPdfPreviewFile = null;
    this.clientPdfPreviewJob = null;
  }

  private buildPrintableDocument(job: WorkshopJob, documentType: 'Job Card' | 'Estimate' | 'Invoice'): string {
    const balance = Math.max((job.estimate || 0) - (job.paid || 0), 0);
    const photos = job.attachments.filter(attachment => attachment.type === 'Vehicle photo' && attachment.srcImg);
    const slips = job.attachments.filter(attachment => attachment.type === 'Parts slip');
    const paymentProofs = job.attachments.filter(attachment => attachment.type === 'Proof of payment');
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
    const paymentProofImages = paymentProofs.filter(proof => proof.mimeType.startsWith('image/') && proof.srcImg);
    const paymentProofFiles = paymentProofs.filter(proof => !proof.mimeType.startsWith('image/'));
    const paymentProofHtml = '<section class="evidence"><h2>Proof of payment</h2>' + (paymentProofs.length
      ? (paymentProofImages.length
          ? '<div class="photo-grid">' + paymentProofImages.map(proof =>
            '<figure><img src="' + this.escapeHtml(proof.srcImg) + '" alt="Proof of payment"><figcaption>' + this.escapeHtml(proof.fileName) + '</figcaption></figure>'
          ).join('') + '</div>'
          : '') + (paymentProofFiles.length
          ? '<ul>' + paymentProofFiles.map(proof => '<li>' + this.escapeHtml(proof.fileName) + ' - added ' + this.escapeHtml(new Date(proof.createdAt).toLocaleDateString('en-ZA')) + '</li>').join('') + '</ul>'
          : '')
      : '<p>No proof of payment was attached.</p>') + '</section>';
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
            <tr><th>Customer approval</th><td>${this.escapeHtml(job.customerApproval || 'Not requested')}${job.approvalMethod ? ' by ' + this.escapeHtml(job.approvalMethod) : ''}</td></tr>
            <tr><th>Estimate</th><td>R${job.estimate || 0}</td></tr>
            <tr><th>Paid</th><td>R${job.paid || 0}</td></tr>
            <tr><th>Last payment date</th><td>${this.escapeHtml(job.paymentDate ? new Date(job.paymentDate + 'T00:00:00').toLocaleDateString('en-ZA') : 'Not recorded')}</td></tr>
            <tr><th>Balance</th><td>R${balance}</td></tr>
          </table>
          <div class="note"><strong>Work notes</strong><p>${this.escapeHtml(job.notes || 'No notes captured.')}</p></div>
          <div class="note"><strong>Parts and supplier slip notes</strong><p>${this.escapeHtml(job.partsNotes || 'No parts slip notes captured.')}</p></div>
          <div class="note"><strong>Quality control</strong><p>${this.escapeHtml(job.qualityNotes || 'No quality notes captured.')}</p></div>
          ${photoHtml}
          ${slipHtml}
          ${paymentProofHtml}
        </body>
      </html>
    `;
  }

  private async createWorkshopAttachment(file: File, type: WorkshopAttachmentType, jobId = this.editingWorkshopJobId || crypto.randomUUID()): Promise<WorkshopAttachment> {
    let srcImg = '';
    let storagePath = '';
    if (this.siteService.isConfigured && this.isSignedIn) {
      try {
        const stored = await this.siteService.uploadWorkshopAttachment(file, jobId, type);
        srcImg = stored.srcImg;
        storagePath = stored.storagePath;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Supabase Storage error.';
        if (message.toLowerCase().includes('bucket not found')) {
          throw new Error('Workshop file storage has not been configured. Run supabase-storage-repair.sql in the Supabase SQL Editor, then try again.');
        }
        if (message.toLowerCase().includes('not authorized') || message.toLowerCase().includes('row-level security')) {
          throw new Error('Your workshop account is not allowed to upload files. Sign out and back in, then check the Storage policies in supabase-storage-repair.sql.');
        }
        throw new Error('Secure file upload failed: ' + message);
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
