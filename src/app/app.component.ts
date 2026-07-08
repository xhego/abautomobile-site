import { Component, OnInit } from '@angular/core';

interface GalleryImage {
  srcImg: string;
  title: string;
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
  readonly maxImages = 10;
  readonly descriptionLimit = 50;
  readonly currentYear = new Date().getFullYear();
  readonly defaultLocation = 'Meyerton, Gauteng, South Africa';
  readonly defaultCallNumber = '067 825 2864';
  readonly defaultWhatsappNumber = '073 015 1945';
  private readonly galleryStorageKey = 'abautomobile-gallery-images';
  private readonly galleryInitializedStorageKey = 'abautomobile-gallery-initialized';
  private readonly locationStorageKey = 'abautomobile-workshop-location';
  private readonly callNumberStorageKey = 'abautomobile-call-number';
  private readonly whatsappNumberStorageKey = 'abautomobile-whatsapp-number';
  private readonly adminUsername = 'mechanic';
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
  callNumberDraft = this.defaultCallNumber;
  whatsappNumberDraft = this.defaultWhatsappNumber;
  isSignedIn = false;
  showAdmin = false;
  signInError = '';
  uploadError = '';
  adminNotice = '';
  descriptionDraft = '';
  isProcessingImages = false;
  adminRefreshKey = 0;
  login = {
    username: '',
    password: ''
  };

  ngOnInit(): void {
    this.galleryImages = this.loadGallery();
    this.workshopLocation = localStorage.getItem(this.locationStorageKey) || this.defaultLocation;
    this.locationDraft = this.workshopLocation;
    this.callNumber = localStorage.getItem(this.callNumberStorageKey) || this.defaultCallNumber;
    this.whatsappNumber = localStorage.getItem(this.whatsappNumberStorageKey) || this.defaultWhatsappNumber;
    this.callNumberDraft = this.callNumber;
    this.whatsappNumberDraft = this.whatsappNumber;
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

  openAdmin(event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.showAdmin = true;
    setTimeout(() => document.getElementById('admin')?.scrollIntoView({ behavior: 'smooth' }));
  }

  signIn(): void {
    const username = this.login.username.trim().toLowerCase();
    if (username === this.adminUsername && this.login.password === this.adminPassword) {
      this.isSignedIn = true;
      this.showAdmin = true;
      this.signInError = '';
      this.login.password = '';
      return;
    }

    this.signInError = 'Incorrect sign-in details.';
  }

  signOut(): void {
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
      this.uploadError = 'The gallery already has 10 images. Remove one before adding another.';
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
      const images = await Promise.all(selectedFiles.map(file => this.readImageFile(file, description)));
      this.galleryImages = this.galleryImages.concat(images).slice(0, this.maxImages);
      this.descriptionDraft = '';
      this.refreshAdminGallery('Gallery refreshed with ' + images.length + ' new image' + (images.length === 1 ? '.' : 's.'));
      this.uploadError = skippedCount > 0 ? 'Only the first ' + availableSlots + ' images were added to keep the gallery at 10.' : '';
    } catch (error) {
      this.uploadError = 'One of those images could not be added.';
    } finally {
      this.isProcessingImages = false;
      input.value = '';
    }
  }

  updateImageTitle(index: number, title: string): void {
    const image = this.galleryImages[index];
    if (!image) {
      return;
    }

    image.title = this.toShortDescription(title);
    this.saveGallery();
  }

  removeImage(index: number): void {
    this.galleryImages = this.galleryImages.filter((_, itemIndex) => itemIndex !== index);
    this.refreshAdminGallery('Gallery refreshed after removing an image.');
    this.uploadError = '';
  }

  resetGallery(): void {
    this.galleryImages = this.defaultImages.slice(0, this.maxImages);
    this.refreshAdminGallery('Gallery refreshed with the default images.');
    this.uploadError = '';
  }

  saveLocation(): void {
    const nextLocation = this.locationDraft.trim() || this.defaultLocation;
    this.workshopLocation = nextLocation;
    this.locationDraft = nextLocation;
    localStorage.setItem(this.locationStorageKey, nextLocation);
  }

  saveContactNumbers(): void {
    const nextCallNumber = this.callNumberDraft.trim() || this.defaultCallNumber;
    const nextWhatsappNumber = this.whatsappNumberDraft.trim() || this.defaultWhatsappNumber;
    this.callNumber = nextCallNumber;
    this.whatsappNumber = nextWhatsappNumber;
    this.callNumberDraft = nextCallNumber;
    this.whatsappNumberDraft = nextWhatsappNumber;
    localStorage.setItem(this.callNumberStorageKey, nextCallNumber);
    localStorage.setItem(this.whatsappNumberStorageKey, nextWhatsappNumber);
  }

  private loadGallery(): GalleryImage[] {
    const storedGallery = localStorage.getItem(this.galleryStorageKey);
    const hasSavedGallery = localStorage.getItem(this.galleryInitializedStorageKey) === 'true';
    if (!storedGallery) {
      return hasSavedGallery ? [] : this.defaultImages.slice(0, this.maxImages);
    }

    try {
      const parsedGallery = JSON.parse(storedGallery) as GalleryImage[];
      if (Array.isArray(parsedGallery)) {
        return parsedGallery.filter(item => item && item.srcImg).map(item => ({
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
}
