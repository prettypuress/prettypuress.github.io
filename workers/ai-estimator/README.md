# Pretty Puress AI Estimator Worker

This Cloudflare Worker keeps AI analysis off the GitHub Pages frontend. The website sends uploaded Cloudinary image URLs and order context to this Worker, and the Worker calls Workers AI through the `AI` binding.

## Deploy

1. Install dependencies in this folder.
2. Log in to Cloudflare with Wrangler.
3. Deploy the Worker.

```sh
npm install
npm run deploy
```

After deployment, copy the Workers URL into `AI_ESTIMATE_WORKER_URL` in the main `index.html`.

## Local Tests

```sh
npm test
```

The tests validate request safety, structured AI response handling, and the required Signature, Luxury, Deluxe Freestyle, multi-photo, and high-price cases.
