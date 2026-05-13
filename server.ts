import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = 3000;

app.use(express.json());

async function getPdfBase64(pdfUrl: string) {
  // Download PDF as buffer
  const pdfResponse = await axios.get(pdfUrl, { 
    responseType: 'arraybuffer',
    headers: { 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
  });
  return Buffer.from(pdfResponse.data).toString('base64');
}

app.get("/api/sync", async (req, res) => {
  try {
    const customUrl = req.query.url as string;
    const siteUrl = "https://rendivalores.com/";
    const axiosConfig = { 
      timeout: 15000, 
      headers: { 
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer': 'https://www.google.com/'
      } 
    };

    let pdfUrl = customUrl || "";
    const logTrace: string[] = [];

    if (customUrl) {
      logTrace.push(`Usando URL manual: ${customUrl}`);
    }
    
    // Strategy 1: Scrape Rendivalores Home
    if (!pdfUrl) {
      try {
        logTrace.push(`Intentando scrapear home de Rendivalores: ${siteUrl}`);
        const homeResp = await axios.get(siteUrl, axiosConfig);
        const $ = cheerio.load(homeResp.data);
        $("a").each((i, el) => {
          const href = $(el).attr("href");
          const text = $(el).text().toLowerCase();
          if (href && href.toLowerCase().endsWith(".pdf") && (href.toLowerCase().includes("resumen") || text.includes("resumen"))) {
            pdfUrl = href.startsWith("http") ? href : new URL(href, siteUrl).href;
            return false;
          }
        });
        if (pdfUrl) logTrace.push(`Encontrado en home de Rendivalores: ${pdfUrl}`);
      } catch (e: any) {
        logTrace.push(`Scraping home de Rendivalores falló: ${e.message}`);
      }
    }

    // Strategy 2: Scrape BVC Resumen page (Official Primary Source)
    if (!pdfUrl) {
      const bvcPages = [
        "https://www.bolsadecaracas.com/",
        "https://www.bolsadecaracas.com/informes-diarios/",
        "https://www.bolsadecaracas.com/mercado/resumen-diario-de-mercado/",
        "https://www.bolsadecaracas.com/estadisticas/resumen-diario-de-mercado/",
        "https://www.bolsadecaracas.com/estadistica/resumen-diario-de-mercado/",
        "https://www.bolsadecaracas.com/mercado/estadisticas/",
        "https://www.bolsadecaracas.com/informes/boletin-diario/",
        "https://www.bolsadecaracas.com/category/resumen-diario/",
        "https://www.bolsadecaracas.com/category/boletin-diario/"
      ];
      for (const bvcUrl of bvcPages) {
        try {
          logTrace.push(`Intentando BVC: ${bvcUrl}`);
          const bvcResp = await axios.get(bvcUrl, axiosConfig);
          const $ = cheerio.load(bvcResp.data);
          let foundInPage = "";
          $("a").each((i, el) => {
            const href = $(el).attr("href");
            const text = $(el).text().toLowerCase();
            if (href && href.toLowerCase().endsWith(".pdf")) {
              if (text.includes("resumen") || text.includes("reporte") || href.toUpperCase().includes("RD") || href.includes("Resumen")) {
                foundInPage = href.startsWith("http") ? href : new URL(href, "https://www.bolsadecaracas.com/").href;
                return false;
              }
            }
          });
          if (foundInPage) {
            pdfUrl = foundInPage;
            logTrace.push(`Encontrado en BVC ${bvcUrl}: ${pdfUrl}`);
            break;
          }
        } catch (e: any) {
          logTrace.push(`Scraping BVC ${bvcUrl} falló: ${e.message}`);
        }
      }
    }

    // Strategy 3: Guessing URLs (Rendivalores & BVC Patterns)
    if (!pdfUrl) {
      const now = new Date();
      logTrace.push(`Iniciando búsqueda bruta por fecha (últimos 5 días)`);
      for (let i = 0; i < 5; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const yy = y.toString().slice(-2);

        const candidates = [
          `https://www.bolsadecaracas.com/wp-content/uploads/${y}/${m}/RD${d}${m}${yy}.pdf`,
          `https://www.bolsadecaracas.com/wp-content/uploads/${y}/${m}/rd${d}${m}${yy}.pdf`,
          `https://www.bolsadecaracas.com/wp-content/uploads/RD${d}${m}${yy}.pdf`,
          `https://www.bolsadecaracas.com/wp-content/uploads/${y}/${m}/Resumen_Diario_${d}_${m}_${y}.pdf`,
          `https://www.bolsadecaracas.com/wp-content/uploads/${y}/${m}/RD-${d}-${m}-${yy}.pdf`,
          `https://rendivalores.com/assets/pdfs/resumen/Resumen_Diario_${d}_${m}_${y}.pdf`,
          `https://rendivalores.com/wp-content/uploads/${y}/${m}/Resumen_Diario_${d}_${m}_${y}.pdf`,
        ];

        for (const candidate of candidates) {
          try {
            logTrace.push(`Probando: ${candidate}`);
            // Using GET with small timeout and range header to save bandwidth
            await axios.head(candidate, { ...axiosConfig, timeout: 5000 });
            pdfUrl = candidate;
            logTrace.push(`ÉXITO: ${pdfUrl}`);
            break;
          } catch {
            // Continue
          }
        }
        if (pdfUrl) break;
      }
    }

    if (!pdfUrl) {
      console.error("Trace de sincronización completa:", logTrace.join("\n"));
      throw new Error(`No se pudo localizar el reporte más reciente automáticamente. Intenta copiar el link directo al PDF y pegarlo. Detalle: ${logTrace.slice(-2).join(" | ")}`);
    }

    const pdfBase64 = await getPdfBase64(pdfUrl);
    res.json({ pdfBase64, pdfUrl });
  } catch (error: any) {
    console.error("Sync error:", error);
    res.status(500).json({ error: error.message || "Failed to sync data" });
  }
});

// Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
