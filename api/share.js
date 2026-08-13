export default function handler(req, res) {
  const { img } = req.query;

  if (!img) {
    return res.status(400).send('Missing image URL parameter.');
  }

  const decodedUrl = decodeURIComponent(img);

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>HH Goa 2026 — Frame Generator</title>
        <meta property="og:title" content="I'm building at HH Goa 2026">
        <meta property="og:description" content="Frame In Goa — get your badge at HH Goa 2026">
        <meta property="og:image" content="${decodedUrl}">
        <meta name="twitter:card" content="summary_large_image">
        <script>
          // Redirect the user to the main page since this page is just for crawler metadata
          window.location.href = "/";
        </script>
      </head>
      <body style="background: #0a0410; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh;">
        Redirecting to the generator...
      </body>
    </html>
  `);
}
