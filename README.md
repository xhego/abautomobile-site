# Abautomobile

AB's Auto Mobile Mechanic (Pty) Ltd one-page site.

## Supabase setup

Admin images and contact details are designed to persist through Supabase.

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase-setup.sql`.
3. In Supabase Auth, create the mechanic admin user with an email and password.
4. Copy the project URL and anon/public key into:
   - `src/environments/environment.ts`
   - `src/environments/environment.prod.ts`
5. Build and deploy.

The `gallery` bucket is public for image viewing. Table and storage writes require an authenticated Supabase user.

## Workshop management setup

The Supabase workshop management specification is documented in `docs/workshop-management-supabase-spec.md`.

When you are ready to create the full workshop database foundation, open the Supabase SQL editor and run:

1. `supabase-setup.sql`
2. `supabase-workshop-management.sql`

The workshop setup creates private operational tables, RLS permission helpers, status/payment functions, scheduling guards, and private Storage buckets for vehicle photos and workshop documents.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
