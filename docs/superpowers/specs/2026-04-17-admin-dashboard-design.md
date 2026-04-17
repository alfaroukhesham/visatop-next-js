# Admin Dashboard & Applications Management Design

## 1. Overview
This specification outlines the redesign of the Admin portal to transition from static mockup pages to fully functional CRUD applications and analytics tools. The goal is to provide administrators with the tools to review, edit, and manage visa applications, as well as view high-level analytics and user histories, while maintaining the existing routing hub as the landing experience.

## 2. Navigation & Structure
- **Landing Experience**: The admin portal entry point (`/admin`) will remain the "Routing Hub" (a grid of module cards). 
- **Cleanup**: Existing static placeholder pages (e.g., `/admin/operations`, `/admin/automations`) will be removed.
- **New Modules**: The routing hub will be updated to point to the two new functional areas:
  - **Applications**: `/admin/applications`
  - **Analytics**: `/admin/analytics`

## 3. Applications Management (CRUD)
The Applications module serves as the primary workspace for processing visa requests.

### 3.1 List View (`/admin/applications`)
- **Layout**: Full-width data table.
- **Columns**: Application ID, Applicant Name, Destination/Service, Status, and Date Submitted.
- **Functionality**: Basic filtering by status (e.g., Pending, Processing) to manage the verification queue. Clicking a row navigates to the Detail Page.

### 3.2 Detail Page (`/admin/applications/[id]`)
- **Layout**: Dedicated full-screen workspace.
- **Read & Review**: Side-by-side view displaying the uploaded documents (e.g., Passport Image) alongside the extracted applicant data.
- **Update**: 
  - Editable form fields allowing admins to manually override or correct OCR-extracted data (Name, Date of Birth, Passport Number, etc.).
  - Status controls to advance the application through its lifecycle (e.g., from `Processing` to `Awaiting Embassy` or `Approved`).
- **Delete**: A prominent but guarded (requires confirmation) destructive action to delete the application and cascade-delete its associated documents/blobs.

## 4. Analytics & User Directory
The Analytics module provides both high-level insights and a directory of users interacting with the platform.

### 4.1 Analytics Hub (`/admin/analytics`)
- **Overview Metrics**: Top section displaying aggregated data such as total active applications, total registered/guest users, and recent amounts paid.
- **User Directory**: A data table below the metrics listing all users (authenticated clients and guest emails). Clicking a user row navigates to the User Drill-down page.

### 4.2 User Drill-down (`/admin/analytics/users/[id]`)
- **Layout**: Detail page focused on a specific user's history and lifetime value.
- **Content**: 
  - User contact details (Email, Phone).
  - Financial summary (total amounts paid for services).
  - History of all past and currently active applications submitted by this user.

## 5. Technical Considerations
- **Data Fetching**: All pages will use Server Components for initial data fetching where possible.
- **State Updates**: Updates to applications and user data will be handled via Server Actions or the existing `/api/admin` routes.
- **Access Control**: These routes will be protected under the `(protected)` admin layout. Standard role-based access checks will apply to ensure only admins can perform CRUD operations.
