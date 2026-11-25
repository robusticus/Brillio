# Listings web

Start the sibling listings-api server first. From this directory, run `npm install` then `npm run dev` with Node 22.12+ and open the URL printed by Vite. The Vite dev and preview servers forward /api calls to http://127.0.0.1:8000.

Enter a minimum price, maximum price, minimum bedroom count or city. Use the keyword field below them for ranked semantic search. Choose Search listings to apply the filters together. An empty search shows all listings.

Run `npm run build` for type checking and a production build. A production host must forward /api requests to the Python API.
