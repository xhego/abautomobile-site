import { Component, HostListener, OnInit } from '@angular/core';
import { SupabaseSiteService } from './supabase-site.service';

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

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
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
  private readonly adminUsername = 'abautomobile@gmail.com';
  private readonly adminPassword = 'workshop2026';

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
  uploadError = '';
  adminNotice = '';
  descriptionDraft = '';
  isSigningIn = false;
  isProcessingImages = false;
  showPassword = false;
  isGalleryPage = false;
  isSignInPage = false;
  activeSection = '';
  adminRefreshKey = 0;
  activeGalleryIndex: number | null = null;
  login = {
    username: '',
    password: ''
  };

  constructor(private readonly siteService: SupabaseSiteService) {}

  ngOnInit(): void {
    this.setCurrentPage();
    this.loadLocalFallback();
    void this.loadRemoteContent();
    setTimeout(() => {
      this.scrollToCurrentHash();
      this.updateActiveSection();
    });
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

  navigateToPage(page: 'home' | 'gallery' | 'signin', event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.isGalleryPage = page === 'gallery';
    this.isSignInPage = page === 'signin';
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
      return this.isSignInPage;
    }

    if (section === 'work' && this.isGalleryPage) {
      return true;
    }

    return !this.isGalleryPage && !this.isSignInPage && this.activeSection === section;
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
    const username = this.login.username.trim();
    this.signInError = '';
    this.isSigningIn = true;

    try {
      if (this.siteService.isConfigured) {
        await this.siteService.signIn(username, this.login.password);
      } else if (username.toLowerCase() !== this.adminUsername || this.login.password !== this.adminPassword) {
        this.signInError = 'Incorrect sign-in details.';
        return;
      }

      this.isSignedIn = true;
      this.showAdmin = true;
      this.login.password = '';
    } catch (error) {
      this.signInError = 'Incorrect sign-in details.';
    } finally {
      this.isSigningIn = false;
    }
  }

  async signOut(): Promise<void> {
    await this.siteService.signOut();
    this.isSignedIn = false;
    this.showAdmin = false;
    this.login = { username: '', password: '' };
    this.uploadError = '';
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []).filter(file => file.type.indexOf('image/') === 0);
    const availableSlots = this.maxImages - this.galleryImages.length;
    this.uploadError = '';
    this.adminNotice = '';

    if (availableSlots <= 0) {
      this.uploadError = 'The gallery already has ' + this.maxImages + ' images. Remove one before adding another.';
      input.value = '';
      return;
    }

    if (!files.length) {
      this.uploadError = 'Choose an image file to add.';
      input.value = '';
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    const skippedCount = files.length - selectedFiles.length;
    const description = this.toShortDescription(this.descriptionDraft);
    this.isProcessingImages = true;

    try {
      const images = this.siteService.isConfigured
        ? await this.uploadRemoteImages(selectedFiles, description)
        : await Promise.all(selectedFiles.map(file => this.readImageFile(file, description)));
      this.galleryImages = this.galleryImages.concat(images).slice(0, this.maxImages);
      this.descriptionDraft = '';
      this.refreshAdminGallery('Gallery refreshed with ' + images.length + ' new image' + (images.length === 1 ? '.' : 's.'));
      this.uploadError = skippedCount > 0 ? 'Only the first ' + availableSlots + ' images were added to keep the gallery at ' + this.maxImages + '.' : '';
    } catch (error) {
      this.uploadError = 'One of those images could not be added.';
    } finally {
      this.isProcessingImages = false;
      input.value = '';
    }
  }

  async updateImageTitle(index: number, title: string): Promise<void> {
    const image = this.galleryImages[index];
    if (!image) {
      return;
    }

    image.title = this.toShortDescription(title);
    if (!this.siteService.isConfigured || !image.id) {
      this.saveGallery();
      return;
    }

    try {
      await this.siteService.updateGalleryTitle(image.id, image.title);
      this.adminNotice = 'Image description saved.';
    } catch (error) {
      this.uploadError = 'That image description could not be saved.';
    }
  }

  async removeImage(index: number): Promise<void> {
    const image = this.galleryImages[index];
    if (!image) {
      return;
    }

    this.uploadError = '';
    if (this.siteService.isConfigured && image.id) {
      this.isProcessingImages = true;
      try {
        await this.siteService.removeGalleryImage(image.id, image.storagePath || '');
      } catch (error) {
        this.uploadError = 'That image could not be removed.';
        this.isProcessingImages = false;
        return;
      }
      this.isProcessingImages = false;
    }

    this.galleryImages = this.galleryImages.filter((_, itemIndex) => itemIndex !== index);
    if (this.activeGalleryIndex !== null) {
      this.activeGalleryIndex = null;
    }
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
    const nextLocation = this.locationDraft.trim() || this.defaultLocation;
    this.workshopLocation = nextLocation;
    this.locationDraft = nextLocation;
    await this.persistSettings();
  }

  async saveContactDetails(): Promise<void> {
    const nextCallNumber = this.callNumberDraft.trim() || this.defaultCallNumber;
    const nextWhatsappNumber = this.whatsappNumberDraft.trim() || this.defaultWhatsappNumber;
    const nextEmailAddress = this.emailAddressDraft.trim() || this.defaultEmailAddress;
    this.callNumber = nextCallNumber;
    this.whatsappNumber = nextWhatsappNumber;
    this.emailAddress = nextEmailAddress;
    this.callNumberDraft = nextCallNumber;
    this.whatsappNumberDraft = nextWhatsappNumber;
    this.emailAddressDraft = nextEmailAddress;
    await this.persistSettings();
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

  private async uploadRemoteImages(files: File[], description: string): Promise<GalleryImage[]> {
    const startIndex = this.galleryImages.length;
    return Promise.all(files.map((file, index) =>
      this.siteService.uploadGalleryImage(file, description, startIndex + index + 1)
    ));
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

  private refreshAdminGallery(message: string): void {
    this.saveGallery();
    this.adminRefreshKey++;
    this.adminNotice = message;
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
    if (this.isGalleryPage || this.isSignInPage || !window.location.hash) {
      return;
    }

    this.scrollToSection(window.location.hash.replace('#', ''));
  }

  private setCurrentPage(): void {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    this.isGalleryPage = currentPath === '/gallery';
    this.isSignInPage = currentPath === '/signin';
    this.showAdmin = this.isSignInPage;
  }

  private updateActiveSection(): void {
    if (this.isGalleryPage || this.isSignInPage) {
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
