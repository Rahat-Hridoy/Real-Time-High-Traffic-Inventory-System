Act as a Senior Frontend & UI/UX Expert. We are refining the UI/UX of our existing project while keeping the core backend, database, and concurrency logic intact.

CURRENT CONTEXT: 
- Backend (Node.js/Sequelize), Socket.io, and Reservation system are fully functional.
- Do NOT alter any backend API routes, socket events, or reservation logic. 

YOUR TASK: Refactor and enhance the Login and Dashboard (Product) pages.

1. LOGIN PAGE REFINEMENT:
   - Create a clean, minimalist, and "modern" login page.
   - UI: Centered card layout.
   - Testing Feature: Pre-fill the input fields with sample credentials (e.g., test@example.com / password123) by default so I can click "Login" and test instantly. some other credentials are shown into a simple card below the login card so that user can easyly copy and paste the credential to login. 
   - Success Flow: Upon successful login, store the JWT/User session and redirect to the Product Dashboard.

2. PRODUCT DASHBOARD (E-commerce Style):
   - Layout: Use a clean, professional e-commerce grid design.
   - Display: Show existing 'Drops' data fetched from the API.
   - Card Details: Each product card should show: Image placeholder, Product Name, Price, Stock Status, and a prominent "Reserve" button.
   - Responsiveness: Maintain the fixed 2-column grid structure (as per previous requirements) that adapts to the sidebar width.

3. HEADER & NAVBAR (Global):
   - Add a top-bar (Navbar) that persists across dashboard pages.
   - Display: User's name/profile icon on the right side.
   - Dropdown: Clicking the user icon should show a simple dropdown menu.
   - Actions: Include a "Logout" button in the dropdown.
   - Logout Flow: Clearing the local session/token and redirecting the user back to the Login page.

4. PRESERVATION & INTEGRATION:
   - Ensure existing socket.io real-time stock updates still work on the new dashboard cards.
   - Ensure 'Reserve' buttons still trigger the existing backend reservation logic.
   - Use Tailwind CSS for all styling to maintain consistency.


Please start this UI/UX refactoring now. If you need me to provide the code for any existing file, let me know.