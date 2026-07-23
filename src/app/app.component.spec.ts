import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { SupabaseSiteService } from './supabase-site.service';

describe('AppComponent', () => {
  const supabaseMock = {
    isConfigured: false,
    signIn: jasmine.createSpy('signIn').and.resolveTo(),
    signOut: jasmine.createSpy('signOut').and.resolveTo(),
    loadSettings: jasmine.createSpy('loadSettings').and.resolveTo(null),
    saveSettings: jasmine.createSpy('saveSettings').and.resolveTo(),
    loadGallery: jasmine.createSpy('loadGallery').and.resolveTo(null),
    uploadGalleryImage: jasmine.createSpy('uploadGalleryImage').and.resolveTo({
      id: 'test-image',
      srcImg: 'assets/test.jpg',
      title: 'Saved repair photo',
      storagePath: 'gallery/test.jpg',
      sortOrder: 1
    }),
    updateGalleryTitle: jasmine.createSpy('updateGalleryTitle').and.resolveTo(),
    removeGalleryImage: jasmine.createSpy('removeGalleryImage').and.resolveTo()
  };

  beforeEach(async () => {
    history.pushState({}, '', '/');
    localStorage.clear();
    supabaseMock.signIn.calls.reset();
    supabaseMock.signIn.and.resolveTo();
    supabaseMock.isConfigured = false;
    supabaseMock.signOut.calls.reset();
    supabaseMock.signOut.and.resolveTo();
    supabaseMock.loadSettings.calls.reset();
    supabaseMock.loadSettings.and.resolveTo(null);
    supabaseMock.saveSettings.calls.reset();
    supabaseMock.saveSettings.and.resolveTo();
    supabaseMock.loadGallery.calls.reset();
    supabaseMock.loadGallery.and.resolveTo(null);
    supabaseMock.uploadGalleryImage.calls.reset();
    supabaseMock.uploadGalleryImage.and.resolveTo({
      id: 'test-image',
      srcImg: 'assets/test.jpg',
      title: 'Saved repair photo',
      storagePath: 'gallery/test.jpg',
      sortOrder: 1
    });
    supabaseMock.updateGalleryTitle.calls.reset();
    supabaseMock.updateGalleryTitle.and.resolveTo();
    supabaseMock.removeGalleryImage.calls.reset();
    supabaseMock.removeGalleryImage.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        RouterModule.forRoot([])
      ],
      declarations: [
        AppComponent
      ],
      providers: [
        { provide: SupabaseSiteService, useValue: supabaseMock }
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should keep the admin gallery limit at 50 images with a 5 image landing preview', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.galleryImages = Array.from({ length: app.maxImages }, (_, index) => ({
      srcImg: 'assets/test-' + index + '.jpg',
      title: 'Repair ' + index
    }));
    expect(app.maxImages).toBe(50);
    expect(app.landingGalleryImages.length).toBe(app.landingImageLimit);
  });


  it('should keep mechanic sign in off the landing page', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#admin')).toBeNull();
    expect(compiled.querySelector('.signin-page-main')).toBeNull();
  });

  it('should render sign in on its own page with a home link', () => {
    history.pushState({}, '', '/signin');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.isSignInPage).toBeTrue();
    expect(compiled.querySelector('.signin-page-main')).not.toBeNull();
    expect(compiled.querySelector('#admin')).not.toBeNull();
    expect(compiled.textContent).toContain('Back to home');
  });

  it('should allow the mechanic to reveal and hide the sign in password', () => {
    history.pushState({}, '', '/signin');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const passwordInput = compiled.querySelector('input[name="password"]') as HTMLInputElement;
    const toggle = compiled.querySelector('.password-toggle') as HTMLButtonElement;

    expect(passwordInput.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    expect(passwordInput.type).toBe('text');
    toggle.click();
    fixture.detectChanges();
    expect(passwordInput.type).toBe('password');
  });

  it('should stop the sign in loader if remote sign in does not return', fakeAsync(() => {
    supabaseMock.isConfigured = true;
    supabaseMock.signIn.and.returnValue(new Promise(() => undefined));
    history.pushState({}, '', '/signin');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.login = {
      username: 'abautomobile@gmail.com',
      password: 'admin-password'
    };

    void app.signIn();
    expect(app.isSigningIn).toBeTrue();
    tick(6000);
    expect(app.signInStatus).toContain('Still connecting');
    tick(16000);
    flushMicrotasks();

    expect(app.isSigningIn).toBeFalse();
    expect(app.isSignedIn).toBeFalse();
    expect(app.signInError).toContain('taking too long');
  }));

  it('should not allow fallback admin sign in when Supabase is not configured', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.login = {
      username: 'abautomobile@gmail.com',
      password: 'admin-password'
    };

    await app.signIn();

    expect(app.isSignedIn).toBeFalse();
    expect(app.signInError).toContain('not configured');
  });

  it('should auto sign out after 10 minutes of admin inactivity', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isSignedIn = true;
    app.showAdmin = true;

    app.markAdminActivity();
    tick(10 * 60 * 1000);
    flushMicrotasks();

    expect(app.isSignedIn).toBeFalse();
    expect(app.showAdmin).toBeFalse();
    expect(app.signInError).toContain('Signed out after 10 minutes');
  }));

  it('should wait to auto sign out while admin work is busy', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isSignedIn = true;
    app.showAdmin = true;
    app.isSavingLocation = true;

    app.markAdminActivity();
    tick(10 * 60 * 1000);
    flushMicrotasks();

    expect(app.isSignedIn).toBeTrue();
    app.isSavingLocation = false;
    tick(10 * 60 * 1000);
    flushMicrotasks();
    expect(app.isSignedIn).toBeFalse();
  }));

  it('should cap edited image descriptions at 50 characters', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.galleryImages = [{ srcImg: 'assets/test.jpg', title: '' }];

    app.updateImageTitle(0, 'x'.repeat(60));

    expect(app.galleryImages[0].title.length).toBe(app.descriptionLimit);
  });

  it('should add uploaded images with a capped description and refresh admin', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const input = document.createElement('input');
    const file = new File(['image-bytes'], 'repair-photo.jpg', { type: 'image/jpeg' });
    app.galleryImages = [];
    app.descriptionDraft = 'Mobile repair completed with diagnostic checks'.repeat(2);
    Object.defineProperty(input, 'files', { value: [file] });

    await app.onFilesSelected({ target: input } as unknown as Event);

    expect(app.galleryImages.length).toBe(1);
    expect(app.galleryImages[0].title.length).toBe(app.descriptionLimit);
    expect(app.adminRefreshKey).toBe(1);
    expect(app.adminNotice).toContain('Gallery refreshed');
  });

  it('should reject unsupported or oversized image uploads before saving', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const input = document.createElement('input');
    const svgFile = new File(['<svg></svg>'], 'bad.svg', { type: 'image/svg+xml' });
    const largeFile = new File([new ArrayBuffer((5 * 1024 * 1024) + 1)], 'large.jpg', { type: 'image/jpeg' });
    app.galleryImages = [];
    Object.defineProperty(input, 'files', { value: [svgFile, largeFile] });

    await app.onFilesSelected({ target: input } as unknown as Event);

    expect(app.galleryImages.length).toBe(0);
    expect(app.uploadError).toContain('JPG, PNG, WebP or GIF');
    expect(supabaseMock.uploadGalleryImage).not.toHaveBeenCalled();
  });

  it('should open, navigate and close gallery images', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.galleryImages = [
      { srcImg: 'assets/first.jpg', title: 'First' },
      { srcImg: 'assets/second.jpg', title: 'Second' }
    ];

    app.openGalleryImage(0);
    expect(app.activeGalleryImage?.title).toBe('First');
    app.showNextImage();
    expect(app.activeGalleryImage?.title).toBe('Second');
    app.showPreviousImage();
    expect(app.activeGalleryImage?.title).toBe('First');
    app.closeGalleryImage();
    expect(app.activeGalleryImage).toBeNull();
  });

  it('should keep the full gallery off the landing page', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.gallery-page-main')).toBeNull();
    expect(compiled.querySelector('.preview-gallery-grid')).not.toBeNull();
  });

  it('should render the full gallery on the gallery page', () => {
    history.pushState({}, '', '/gallery');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const app = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    expect(app.isGalleryPage).toBeTrue();
    expect(compiled.querySelector('.gallery-page-main')).not.toBeNull();
    expect(compiled.querySelector('.preview-gallery-grid')).toBeNull();
  });

  it('should keep work highlighted on the full gallery page', () => {
    history.pushState({}, '', '/gallery');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const app = fixture.componentInstance;
    expect(app.isActiveNav('work')).toBeTrue();
    expect(app.isActiveNav('services')).toBeFalse();
    expect(app.isActiveNav('signin')).toBeFalse();
  });

  it('should return from gallery to a home section when a section nav link is clicked', fakeAsync(() => {
    history.pushState({}, '', '/gallery');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const app = fixture.componentInstance;
    app.navigateToSection('work', new MouseEvent('click'));
    fixture.detectChanges();
    tick();

    expect(window.location.pathname).toBe('/');
    expect(window.location.hash).toBe('#work');
    expect(app.isGalleryPage).toBeFalse();
    expect(app.isSignInPage).toBeFalse();
    expect(app.activeSection).toBe('work');
    expect((fixture.nativeElement as HTMLElement).querySelector('#work')).not.toBeNull();
  }));

  it('should return from sign in to a home section when a section nav link is clicked', fakeAsync(() => {
    history.pushState({}, '', '/signin');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const app = fixture.componentInstance;
    app.navigateToSection('terms', new MouseEvent('click'));
    fixture.detectChanges();
    tick();

    expect(window.location.pathname).toBe('/');
    expect(window.location.hash).toBe('#terms');
    expect(app.isSignInPage).toBeFalse();
    expect(app.showAdmin).toBeFalse();
    expect(app.activeSection).toBe('terms');
    expect((fixture.nativeElement as HTMLElement).querySelector('#terms')).not.toBeNull();
  }));

  it('should not include gallery in the main navigation', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const navText = compiled.querySelector('.nav-links')?.textContent || '';
    expect(navText).not.toContain('Gallery');
  });

  it('should keep removed images removed after reload', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.galleryImages = [{ srcImg: 'assets/remove-me.jpg', title: 'Remove me' }];

    app.removeImage(0);

    const nextFixture = TestBed.createComponent(AppComponent);
    const nextApp = nextFixture.componentInstance;
    nextApp.ngOnInit();
    expect(nextApp.galleryImages.length).toBe(0);
  });

  it('should keep added images after reload', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const input = document.createElement('input');
    const file = new File(['image-bytes'], 'reload-photo.jpg', { type: 'image/jpeg' });
    app.galleryImages = [];
    app.descriptionDraft = 'Saved repair photo';
    Object.defineProperty(input, 'files', { value: [file] });

    await app.onFilesSelected({ target: input } as unknown as Event);

    const nextFixture = TestBed.createComponent(AppComponent);
    const nextApp = nextFixture.componentInstance;
    nextApp.ngOnInit();
    expect(nextApp.galleryImages.length).toBe(1);
    expect(nextApp.galleryImages[0].title).toBe('Saved repair photo');
  });

  it('should not render a reset gallery action for signed-in admin', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.showAdmin = true;
    fixture.componentInstance.isSignedIn = true;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Reset gallery');
  });

  it('should save contact details and build links after reload', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.callNumberDraft = '011 222 3333';
    app.whatsappNumberDraft = '082 444 5555';
    app.emailAddressDraft = 'service@abautomobile.co.za';

    app.saveContactDetails();

    const nextFixture = TestBed.createComponent(AppComponent);
    const nextApp = nextFixture.componentInstance;
    nextApp.ngOnInit();
    expect(nextApp.callNumber).toBe('011 222 3333');
    expect(nextApp.whatsappNumber).toBe('082 444 5555');
    expect(nextApp.emailAddress).toBe('service@abautomobile.co.za');
    expect(nextApp.callHref).toBe('tel:0112223333');
    expect(nextApp.whatsappHref).toBe('https://wa.me/27824445555');
    expect(nextApp.emailHref).toBe('mailto:service@abautomobile.co.za');
  });

  it('should render the mechanic brand', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand strong')?.textContent).toContain("AB's Auto Mobile Mechanic (Pty) Ltd");
  });

  it('should include expanded motor repair terms clauses', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const termsText = ((fixture.nativeElement as HTMLElement).querySelector('#terms')?.textContent || '').replace(/\s+/g, ' ');

    expect(termsText).toContain('signature, telephone, SMS, WhatsApp, email');
    expect(termsText).toContain('same effect as signed authorisation');
    expect(termsText).toContain('photograph the vehicle');
    expect(termsText).toContain('supplier delays, courier delays, weather, power failures');
    expect(termsText).toContain('unsafe, unlawful');
    expect(termsText).toContain('extended period without communication');
  });
});
