Role: Build a responsive, high-traffic "Sneaker Drop" dashboard with real-time sync.

Task 1: Product Card UI Update
- Create a Product Card component that mimics the reference layout:
  - Header: Product Name, Price, and  image .
  - Stock Badge: Show "X left" or "Sold Out".
  - Button: "Reserve" (Black background).
  - Footer: "Recently Purchased" section showing avatars/icons and usernames of the last 3 buyers.
- Styling: Use clean whitespace and card layout.

Task 2: Real-time Stock & Color Logic
- When a user clicks "Reserve", emit a 'stock-pending' event via Socket.io.
- All clients must instantly change the Stock Badge text/color:
  - Default: Green color ("X left").
  - Pending (Someone is purchasing): Yellow/Orange color (indicating "Reserved/Processing").
- Once the purchase is successful or the reservation expires, the stock count updates and the color reverts to Green.

Task 3: Purchase Flow & Navigation
- When a user clicks "Reserve":
  - Redirect the user to `/purchase/:productId` route.
- Purchase Page:
  - Display full product details (Name, Price, Image).
  - Input field for "Username".
  - "Confirm Purchase" button.
- Success Flow:
  - After API validation, show a "Success" message.
  - Display a "Back to Home" button.
- Ensure the backend handles the reservation lock for 60 seconds. If the user doesn't complete the purchase within 60s, the backend must auto-release the lock and broadcast the stock update to all clients.

Requirements:
- Ensure the UI for the "Recently Purchased" section updates in real-time as well.
- Maintain a clean, minimalist design using Tailwind CSS.
- Ensure the 2-column grid layout is responsive and maintains the column structure as per previous project specs.