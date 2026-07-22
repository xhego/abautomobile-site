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
  private readonly client: SupabaseClient | null = environment.supabaseUrl && environment.supabaseAnonKey
    ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
    : null;

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async signIn(email: string, password: string): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.auth.signOut();
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
}
