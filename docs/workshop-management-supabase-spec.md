# AB's Auto Mobile Mechanic (Pty) Ltd Workshop Management Specification

This specification adapts the original workshop management module for the current Angular and Supabase architecture.

Supabase replaces the previous ASP.NET Core Web API, Entity Framework Core, SQL Server, and server-side authentication assumptions.

## Primary Requirement

Create a professional workshop management module for the authenticated admin area.

The module should be a separate admin experience, not a crowded section inside the existing admin dashboard.

Preferred routes:

- `/admin`
- `/admin/workshop-management`
- `/admin/workshop-management/dashboard`
- `/admin/workshop-management/calendar`
- `/admin/workshop-management/bookings`
- `/admin/workshop-management/board`
- `/admin/workshop-management/mobile-callouts`
- `/admin/workshop-management/job-cards`
- `/admin/workshop-management/customers`
- `/admin/workshop-management/vehicles`
- `/admin/workshop-management/estimates`
- `/admin/workshop-management/invoices`
- `/admin/workshop-management/payments`
- `/admin/workshop-management/parts`
- `/admin/workshop-management/suppliers`
- `/admin/workshop-management/quality-control`
- `/admin/workshop-management/mechanics`
- `/admin/workshop-management/reports`
- `/admin/workshop-management/settings`

The admin dashboard must include a large card or button that navigates to Workshop Management.

The Workshop Management page must include a visible back button:

`Back to Admin Dashboard`

## Technical Stack

Frontend:

- Angular
- TypeScript
- Angular services backed by Supabase
- Reactive forms where larger forms are introduced
- SCSS or existing CSS conventions
- Responsive desktop, tablet, and mobile layouts

Backend/data platform:

- Supabase PostgreSQL
- Supabase Auth
- Supabase Row Level Security
- PostgreSQL functions for business rules
- PostgreSQL transactions for multi-step operations
- Supabase Storage for vehicle photos and payment documents
- Supabase Realtime where useful for workshop board updates

Do not introduce ASP.NET Core Web API endpoints.

Do not introduce Entity Framework migrations.

Do not introduce SQL Server.

## Authentication And Permissions

Supabase Auth is the source of truth for admin and workshop staff access.

Use authenticated Supabase users with app-level roles stored in a profile/permissions table.

Suggested roles:

- `admin`
- `workshop_manager`
- `mechanic`
- `viewer`

Suggested permissions:

- `workshop.view`
- `workshop.manage_customers`
- `workshop.manage_vehicles`
- `workshop.view_full_vin`
- `workshop.manage_bookings`
- `workshop.manage_job_cards`
- `workshop.change_job_status`
- `workshop.manage_estimates`
- `workshop.record_approvals`
- `workshop.manage_parts`
- `workshop.manage_invoices`
- `workshop.record_payments`
- `workshop.verify_payments`
- `workshop.perform_quality_control`
- `workshop.view_reports`
- `workshop.export_data`
- `workshop.admin_override`

Angular route guards must check Supabase session state before allowing admin pages.

Supabase RLS must enforce permissions at database level. The frontend must never be trusted as the only permission layer.

## Supabase Database Design

Use normalized PostgreSQL tables.

Do not put all data into one `workshop_jobs` table.

Primary keys should use `uuid` with `gen_random_uuid()` unless a table requires human-readable generated numbers.

All business tables should include:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `created_by uuid references auth.users(id)`
- `updated_at timestamptz`
- `updated_by uuid references auth.users(id)`
- `is_active boolean not null default true`

Use foreign keys, indexes, unique constraints, check constraints, and transactional functions.

Use `numeric(12,2)` for money values.

Use `timestamptz` for absolute date/time values.

Use `date` for service dates and due dates where time is not needed.

## Core Tables

Create at minimum:

- `workshop_profiles`
- `workshop_role_permissions`
- `workshop_customers`
- `workshop_vehicles`
- `workshop_bays`
- `workshop_mechanics`
- `workshop_bookings`
- `workshop_mobile_callouts`
- `workshop_job_cards`
- `workshop_job_status_history`
- `workshop_job_tasks`
- `workshop_time_entries`
- `workshop_inspections`
- `workshop_inspection_items`
- `workshop_estimates`
- `workshop_estimate_items`
- `workshop_estimate_approvals`
- `workshop_invoices`
- `workshop_invoice_items`
- `workshop_payments`
- `workshop_payment_allocations`
- `workshop_parts`
- `workshop_part_orders`
- `workshop_suppliers`
- `workshop_quality_checks`
- `workshop_vehicle_photos`
- `workshop_documents`
- `workshop_settings`
- `workshop_audit_logs`

## Customers

Table: `workshop_customers`

Fields:

- `customer_number text not null unique`
- `customer_type text not null check (customer_type in ('individual', 'company', 'fleet'))`
- `first_name text`
- `last_name text`
- `company_name text`
- `contact_person text`
- `mobile_number text not null`
- `alternate_number text`
- `whatsapp_number text`
- `email_address text`
- `address_line_1 text`
- `address_line_2 text`
- `suburb text`
- `city text`
- `province text`
- `postal_code text`
- `preferred_contact_method text`
- `notes text`
- `popia_consent_at timestamptz`
- `marketing_consent boolean not null default false`

Customer numbers must be generated by a PostgreSQL function, not in Angular.

## Vehicles

Table: `workshop_vehicles`

Fields:

- `customer_id uuid not null references workshop_customers(id)`
- `registration_number text`
- `vin text`
- `engine_number text`
- `engine_code text`
- `make text not null`
- `model text not null`
- `variant text`
- `model_year smallint`
- `colour text`
- `fuel_type text`
- `transmission_type text`
- `current_mileage integer`
- `fleet_number text`
- `next_service_date date`
- `next_service_mileage integer`
- `notes text`

VIN rules:

- VIN is optional during enquiry or initial booking.
- VIN should be required before ordering VIN-specific parts or finalising the first job card.
- VIN must be stored uppercase.
- VIN maximum length is 17.
- VIN must exclude `I`, `O`, and `Q`.
- Full VIN must not be exposed in public queries.
- List views should show masked VIN only.
- Full VIN may be visible only to users with `workshop.view_full_vin`.

Recommended indexes:

- Unique partial index on VIN where VIN is not null.
- Index on registration number.
- Index on customer ID.

## Bookings And Scheduling

Table: `workshop_bookings`

Fields:

- `booking_number text not null unique`
- `customer_id uuid not null`
- `vehicle_id uuid`
- `booking_type text not null check (booking_type in ('workshop', 'mobile_callout'))`
- `scheduled_start_at timestamptz not null`
- `scheduled_end_at timestamptz`
- `status text not null`
- `job_type text`
- `location_address text`
- `callout_fee numeric(12,2)`
- `callout_fee_approved boolean not null default false`
- `assigned_mechanic_id uuid`
- `notes text`

Scheduling rules must be enforced by PostgreSQL functions:

- Prevent double-booking the same mechanic during overlapping time windows.
- Prevent double-booking the same workshop bay during overlapping time windows.
- Require call-out fee approval before confirming a mobile call-out.
- Prevent check-in of cancelled bookings.
- Create job cards from confirmed bookings through a transaction.

## Job Cards

Table: `workshop_job_cards`

Fields:

- `job_card_number text not null unique`
- `booking_id uuid`
- `customer_id uuid not null`
- `vehicle_id uuid not null`
- `assigned_mechanic_id uuid`
- `bay_id uuid`
- `status text not null`
- `priority text not null default 'normal'`
- `odometer_reading integer`
- `customer_complaint text`
- `diagnosis_notes text`
- `work_authorised_at timestamptz`
- `expected_completion_at timestamptz`
- `completed_at timestamptz`
- `ready_for_collection_at timestamptz`
- `collected_at timestamptz`
- `total_estimate numeric(12,2) not null default 0`
- `total_invoiced numeric(12,2) not null default 0`
- `total_paid numeric(12,2) not null default 0`
- `outstanding_balance numeric(12,2) generated always as (total_invoiced - total_paid) stored`
- `notes text`

Status workflow:

`booked -> checked_in -> initial_inspection -> diagnosis -> awaiting_approval -> approved -> waiting_for_parts -> in_progress -> quality_control -> ready_for_collection -> completed -> collected`

Additional statuses:

- `on_hold`
- `paused`
- `cancelled`
- `warranty_assessment`

Status changes must happen through a PostgreSQL function such as:

- `workshop_change_job_status(job_card_id uuid, next_status text, note text)`

The function must:

- Validate allowed status transitions.
- Insert into `workshop_job_status_history`.
- Update timestamps such as `ready_for_collection_at`.
- Block collection when the outstanding balance is greater than zero unless an authorised admin override is supplied.
- Write an audit log entry.

## Estimates And Approvals

Tables:

- `workshop_estimates`
- `workshop_estimate_items`
- `workshop_estimate_approvals`

Approvals may be captured by:

- Signature
- Telephone
- SMS
- WhatsApp
- Email

Electronic approvals have the same operational effect as signed authorisation.

Estimate approval and decline actions must be handled by PostgreSQL functions so the estimate status, approval record, job status, and audit log are updated together.

## Invoices And Payments

Tables:

- `workshop_invoices`
- `workshop_invoice_items`
- `workshop_payments`
- `workshop_payment_allocations`

Payment rules:

- Payment is due on completion and before vehicle release unless otherwise agreed in writing.
- Vehicle, keys, parts, and documents may be retained until the outstanding balance is paid.
- Payment allocation must happen in a transaction.
- Payment verification must be restricted to authorised users.
- Do not hard-delete invoices or payments.
- Cancelled invoices must be reversed with audit history.

Payment allocation must be handled by a PostgreSQL function such as:

- `workshop_record_payment(customer_id uuid, job_card_id uuid, amount numeric, method text, reference text)`

The function must:

- Insert the payment.
- Allocate payment to the selected job/invoice.
- Recalculate customer and job balances.
- Write audit history.

## Photos And Documents

Use Supabase Storage.

Recommended buckets:

- `workshop-vehicle-photos`
- `workshop-payment-documents`
- `workshop-quality-documents`

Photos table: `workshop_vehicle_photos`

Fields:

- `job_card_id uuid`
- `vehicle_id uuid`
- `storage_path text not null`
- `photo_type text`
- `caption text`
- `taken_at timestamptz not null default now()`
- `uploaded_by uuid references auth.users(id)`

Document table: `workshop_documents`

Fields:

- `job_card_id uuid`
- `customer_id uuid`
- `payment_id uuid`
- `document_type text not null`
- `storage_path text not null`
- `file_name text`
- `mime_type text`
- `file_size integer`
- `uploaded_by uuid references auth.users(id)`

Storage RLS:

- Public visitors must not read workshop documents.
- Authenticated workshop users may read documents linked to records they are allowed to view.
- Only authorised admin/workshop users may upload or delete files.
- Payment documents must not be publicly accessible.

Customer-facing gallery photos remain separate from private workshop vehicle photos.

## Dashboard

Dashboard cards:

- Bookings today
- Vehicles checked in
- Open jobs
- Jobs in progress
- Awaiting customer approval
- Waiting for parts
- Overdue jobs
- Ready for collection
- Outstanding customer balance
- Revenue today
- Revenue this month

Attention Required:

- Job overdue
- Estimate awaiting approval for more than 24 hours
- Part delivery overdue
- Vehicle ready but not collected
- Customer has an outstanding balance
- Job has no assigned mechanic
- Expected completion time is missing
- Mobile call-out starting soon

Today Schedule:

- Time
- Customer
- Vehicle
- Job type
- Assigned mechanic
- Location
- Status
- Expected completion

Mechanic Workload:

- Mechanic name
- Assigned jobs
- Estimated hours
- Actual hours
- Current job
- Availability

Use PostgreSQL views or RPC functions for dashboard summaries where multiple tables are involved.

## Workshop Board

Create a clear board grouped by status:

- Booked
- Checked in
- Diagnosis
- Awaiting approval
- Waiting for parts
- In repair
- Quality control
- Ready
- Collected

Use Supabase Realtime subscriptions for status changes if the board needs live updates across devices.

Drag-and-drop may be added later, but each movement must still call the PostgreSQL status-change function.

## Quality Control

Quality checks must include:

- Road/test drive completed where required
- Fault confirmed repaired
- Fluid levels checked
- Warning lights checked
- Brakes checked where relevant
- Wheel nuts checked where relevant
- Leaks checked
- Customer concerns reviewed
- Vehicle cleaned where applicable
- Photos added where required

Test driving terms:

- Customer authorises reasonable test drives where needed for diagnosis, repair verification, safety checks, or quality control.
- Test drives must be carried out by authorised staff only.
- Mileage before and after a test drive should be recorded where practical.
- Any incident during a test drive must be recorded and escalated.

## Terms And Conditions Coverage

The workshop management module should support recording customer acceptance of terms that cover:

- Quotes, estimates, and authorisation
- Diagnostic fees
- Customer and vehicle information accuracy
- Payment terms
- Right of retention until payment
- Collection and storage fees
- Storage fee of R250 per day where applicable
- Replaced parts
- Warranty on workmanship and parts
- Customer-supplied parts
- Mobile call-out fees agreed before travel
- Mobile call-out limits due to weather, safety, and access
- Limitation of liability for pre-existing faults and hidden damage
- Photos for records, warranty, quotations, insurance, and quality control
- Electronic approval by signature, telephone, SMS, WhatsApp, or email
- Delays caused by suppliers, courier delays, weather, power failures, additional faults, or safety concerns
- Safety refusal where work would be unsafe or unlawful
- Abandoned vehicles handled according to applicable South African law after reasonable contact attempts
- Test driving authorisation and conditions

## POPIA And Security

Apply practical POPIA-aligned controls:

- Restrict access to authenticated admin/workshop users.
- Use RLS for every workshop table.
- Use least-privilege role permissions.
- Do not expose full VIN in public or general list queries.
- Use summary/detail projections in Angular services.
- Validate and sanitise all inputs.
- Never log passwords, tokens, complete bank card data, private documents, or unnecessary full VINs.
- Add privacy notice text in workshop settings.
- Add retention settings for customer, vehicle, job card, invoice, communication, and audit records.
- Do not hard-delete financial records.
- Use HTTPS.

## Angular Structure

Suggested structure:

```text
src/app/admin/workshop-management/
  components/
    workshop-header/
    workshop-sidebar/
    summary-card/
    attention-list/
    booking-form/
    customer-search/
    vehicle-search/
    job-card-status-chip/
    workshop-board-card/
    estimate-items-table/
    payment-form/
    quality-check-form/
  pages/
    workshop-shell/
    workshop-dashboard/
    workshop-calendar/
    workshop-bookings/
    workshop-board/
    workshop-mobile-callouts/
    workshop-job-cards/
    workshop-job-card-details/
    workshop-customers/
    workshop-customer-details/
    workshop-vehicles/
    workshop-vehicle-details/
    workshop-estimates/
    workshop-invoices/
    workshop-payments/
    workshop-parts/
    workshop-suppliers/
    workshop-quality-control/
    workshop-mechanics/
    workshop-reports/
    workshop-settings/
  models/
  services/
  guards/
  workshop-management.routes.ts
```

Use standalone Angular components if the project uses standalone components. Otherwise match the existing module structure.

## Angular Supabase Services

Create typed Angular services that call Supabase directly:

- `WorkshopDashboardService`
- `WorkshopCustomerService`
- `WorkshopVehicleService`
- `WorkshopBookingService`
- `WorkshopCalendarService`
- `WorkshopJobCardService`
- `WorkshopMechanicService`
- `WorkshopEstimateService`
- `WorkshopPartsService`
- `WorkshopInvoiceService`
- `WorkshopPaymentService`
- `WorkshopQualityControlService`
- `WorkshopReportService`
- `WorkshopStorageService`

Services must:

- Use typed interfaces.
- Avoid `any`.
- Use Supabase query builders for simple reads.
- Use Supabase RPC calls for status changes, number generation, scheduling, approvals, and payments.
- Handle loading, empty states, validation errors, and permission errors.
- Use Storage APIs for photos and documents.

Do not call ASP.NET API endpoints.

## PostgreSQL Functions

Use PostgreSQL functions for business operations that must be atomic:

- Generate customer numbers.
- Generate booking numbers.
- Generate job card numbers.
- Generate estimate numbers.
- Generate invoice numbers.
- Confirm a booking.
- Convert a booking to a job card.
- Change job card status.
- Approve or decline an estimate.
- Assign a mechanic.
- Start, pause, and stop time tracking.
- Record a payment and allocate it.
- Mark a vehicle ready for collection.
- Mark a vehicle collected.
- Record quality control completion.
- Enforce mobile call-out fee approval.
- Enforce scheduling overlap rules.

Functions must run in transactions and write audit records.

## RLS Policy Requirements

Every workshop table must have RLS enabled.

Public visitors:

- No access to workshop operational data.

Authenticated admin/workshop users:

- Read only records permitted by their role.
- Insert/update only records permitted by their role.
- Delete should generally be replaced with soft delete.

Storage buckets must also enforce policies.

Use helper functions such as:

- `is_workshop_admin()`
- `has_workshop_permission(permission_name text)`
- `can_view_workshop_record(record_owner uuid)`

## Reports

Reports:

- Revenue by day/month
- Outstanding balances
- Jobs by status
- Mechanic workload
- Parts usage
- Supplier delays
- Mobile call-out performance
- Warranty/return work
- Overdue jobs
- Vehicle collection delays

Use SQL views or RPC functions for report queries.

## Validation

Validation belongs in both Angular and PostgreSQL.

Angular validation improves user experience.

PostgreSQL constraints and functions enforce truth.

Validate:

- Required customer contact number
- Email format
- VIN length and allowed characters
- Non-negative money values
- Payment amount greater than zero
- Valid status transitions
- Valid date ranges
- No mechanic/bay scheduling conflicts
- Call-out fee approval before dispatch

## Testing

Frontend:

- Route guard tests
- Service tests for Supabase success/failure paths
- Form validation tests
- Workshop board status tests
- Responsive layout checks

Database:

- RLS policy tests
- RPC function tests
- Status transition tests
- Payment allocation tests
- Number generation tests
- Scheduling conflict tests
- Storage policy tests

Manual testing:

- Admin can sign in.
- Non-admin cannot access workshop pages.
- Job card can move through valid statuses.
- Invalid status transition is blocked.
- Mobile call-out requires agreed call-out fee.
- Payment allocation updates balances.
- Private documents are not publicly accessible.

## Implementation Order

1. Define Supabase schema.
2. Add RLS helper functions.
3. Add core tables and policies.
4. Add number generation functions.
5. Add job status workflow function.
6. Add scheduling conflict functions.
7. Add payment allocation function.
8. Add Storage buckets and policies.
9. Add typed Angular models.
10. Add Angular Supabase services.
11. Add route guard integration.
12. Add Workshop Management shell and navigation.
13. Add dashboard.
14. Add customers and vehicles.
15. Add bookings and calendar.
16. Add job cards and workshop board.
17. Add estimates and approvals.
18. Add payments.
19. Add photos and documents.
20. Add quality control.
21. Add reports and settings.
22. Test RLS, workflows, and responsive UI.

## Restrictions

- Do not add ASP.NET Core backend code.
- Do not add Entity Framework migrations.
- Do not add SQL Server scripts.
- Do not store operational workshop data only in browser localStorage.
- Do not expose service role keys to Angular.
- Do not bypass RLS from the client.
- Do not put every workflow into one table or one component.
- Do not hard-delete financial or audit records.
- Do not expose private vehicle photos, payment documents, VINs, or customer details publicly.
