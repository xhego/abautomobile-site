import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

export interface SiteSettings {
  location: string;
  callNumber: string;
  whatsappNumber: string;
  emailAddress: string;
}

export interface StoredGalleryImage {
  id: string;
  srcImg: string;
  title: string;
  storagePath: string;
  sortOrder: number;
}

export interface StoredWorkshopAttachment {
  srcImg: string;
  storagePath: string;
}

interface SiteSettingsRow {
  id: string;
  location: string;
  call_number: string;
  whatsapp_number: string;
  email_address: string;
}

interface GalleryImageRow {
  id: string;
  src_img: string;
  title: string;
  storage_path: string;
  sort_order: number;
}

@Injectable({ providedIn: 'root' })
export class SupabaseSiteService {
  private readonly settingsId = 'main';
  private readonly requestTimeoutMs = 20000;
  private accessToken = '';
  private readonly client: SupabaseClient | null = environment.supabaseUrl && environment.supabaseAnonKey
    ? createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        },
        global: {
          fetch: (input, init) => this.fetchWithTimeout(input, init)
        }
      })
    : null;

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async signIn(email: string, password: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase is not configured yet.');
    }

    this.accessToken = '';
    const response = await this.fetchWithTimeout(environment.supabaseUrl + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        apikey: environment.supabaseAnonKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => null) as { access_token?: string; error_description?: string; msg?: string } | null;

    if (!response.ok || !data?.access_token) {
      throw new Error(data?.error_description || data?.msg || 'Incorrect sign-in details.');
    }

    this.accessToken = data.access_token;
  }

  async signOut(): Promise<void> {
    this.accessToken = '';
  }

  async loadSettings(): Promise<SiteSettings | null> {
    if (!this.client) {
      return null;
    }

    const { data, error } = await this.client
      .from('site_settings')
      .select('id, location, call_number, whatsapp_number, email_address')
      .eq('id', this.settingsId)
      .maybeSingle<SiteSettingsRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      location: data.location,
      callNumber: data.call_number,
      whatsappNumber: data.whatsapp_number,
      emailAddress: data.email_address
    };
  }

  async saveSettings(settings: SiteSettings): Promise<void> {
    const client = this.requireClient();
    const { error } = await client
      .from('site_settings')
      .upsert({
        id: this.settingsId,
        location: settings.location,
        call_number: settings.callNumber,
        whatsapp_number: settings.whatsappNumber,
        email_address: settings.emailAddress,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw error;
    }
  }

  async loadGallery(limit: number): Promise<StoredGalleryImage[] | null> {
    if (!this.client) {
      return null;
    }

    const { data, error } = await this.client
      .from('gallery_images')
      .select('id, src_img, title, storage_path, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit)
      .returns<GalleryImageRow[]>();

    if (error) {
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      srcImg: item.src_img,
      title: item.title || '',
      storagePath: item.storage_path,
      sortOrder: item.sort_order || 0
    }));
  }

  async uploadGalleryImage(file: File, title: string, sortOrder: number): Promise<StoredGalleryImage> {
    const client = this.requireClient();
    const storagePath = this.buildStoragePath(file.name);
    const { error: uploadError } = await client.storage
      .from(environment.supabaseGalleryBucket)
      .upload(storagePath, file, {
        cacheControl: '31536000',
        contentType: file.type || 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = client.storage
      .from(environment.supabaseGalleryBucket)
      .getPublicUrl(storagePath);

    const srcImg = publicUrlData.publicUrl;
    const { data, error: insertError } = await client
      .from('gallery_images')
      .insert({
        src_img: srcImg,
        title,
        storage_path: storagePath,
        sort_order: sortOrder
      })
      .select('id, src_img, title, storage_path, sort_order')
      .single<GalleryImageRow>();

    if (insertError) {
      await client.storage.from(environment.supabaseGalleryBucket).remove([storagePath]);
      throw insertError;
    }

    return {
      id: data.id,
      srcImg: data.src_img,
      title: data.title || '',
      storagePath: data.storage_path,
      sortOrder: data.sort_order || 0
    };
  }

  async updateGalleryTitle(id: string, title: string): Promise<void> {
    const client = this.requireClient();
    const { error } = await client
      .from('gallery_images')
      .update({
        title,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async removeGalleryImage(id: string, storagePath: string): Promise<void> {
    const client = this.requireClient();
    const { error } = await client
      .from('gallery_images')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    if (storagePath) {
      await client.storage.from(environment.supabaseGalleryBucket).remove([storagePath]);
    }
  }

  async uploadWorkshopAttachment(file: File, jobId: string, type: 'Vehicle photo' | 'Parts slip'): Promise<StoredWorkshopAttachment> {
    const client = this.requireClient();
    const bucket = type === 'Vehicle photo' ? 'workshop-vehicle-photos' : 'workshop-payment-documents';
    const storagePath = this.buildWorkshopStoragePath(jobId, file.name);
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(storagePath, file, {
        cacheControl: '31536000',
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data, error: signedUrlError } = await client.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signedUrlError || !data?.signedUrl) {
      await client.storage.from(bucket).remove([storagePath]);
      throw signedUrlError || new Error('The uploaded file could not be prepared for viewing.');
    }

    return { srcImg: data.signedUrl, storagePath };
  }

  async getWorkshopAttachmentUrl(storagePath: string, type: 'Vehicle photo' | 'Parts slip'): Promise<string> {
    const client = this.requireClient();
    const bucket = type === 'Vehicle photo' ? 'workshop-vehicle-photos' : 'workshop-payment-documents';
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (error || !data?.signedUrl) {
      throw error || new Error('The saved file could not be opened.');
    }

    return data.signedUrl;
  }

  async removeWorkshopAttachment(storagePath: string, type: 'Vehicle photo' | 'Parts slip'): Promise<void> {
    if (!storagePath || !this.client) {
      return;
    }

    const bucket = type === 'Vehicle photo' ? 'workshop-vehicle-photos' : 'workshop-payment-documents';
    const { error } = await this.client.storage.from(bucket).remove([storagePath]);
    if (error) {
      throw error;
    }
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase is not configured yet.');
    }

    return this.client;
  }

  private buildStoragePath(fileName: string): string {
    const extension = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
    const safeExtension = (extension || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
    return 'gallery/' + Date.now() + '-' + crypto.randomUUID() + '.' + safeExtension;
  }

  private buildWorkshopStoragePath(jobId: string, fileName: string): string {
    const extension = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
    const safeExtension = (extension || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
    return 'job-card-evidence/' + jobId + '/' + Date.now() + '-' + crypto.randomUUID() + '.' + safeExtension;
  }

  private async fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const upstreamSignal = init?.signal;
    const headers = new Headers(init?.headers);

    if (this.accessToken) {
      headers.set('Authorization', 'Bearer ' + this.accessToken);
    }

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort();
      } else {
        upstreamSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    try {
      return await fetch(input, {
        ...init,
        headers,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
