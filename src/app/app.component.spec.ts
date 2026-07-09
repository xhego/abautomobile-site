import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        RouterModule.forRoot([])
      ],
      declarations: [
        AppComponent
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should keep the default gallery at 10 images', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app.galleryImages.length).toBe(app.maxImages);
  });


  it('should hide mechanic sign in until the nav action is clicked', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#admin')).toBeNull();

    fixture.componentInstance.openAdmin();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.showAdmin).toBeTrue();
  });

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
    expect(compiled.querySelector('.brand strong')?.textContent).toContain("AB's Auto Mobile Mechanic");
  });
});
