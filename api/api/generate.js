export default async function handler(req, res) {

  // Allow requests from the website

  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Browser preflight request

  if (req.method === "OPTIONS") {

    return res.status(200).end();

  }

  // Only allow POST requests

  if (req.method !== "POST") {

    return res.status(405).json({

      error: "Method not allowed",

    });

  }

  try {

    const { promoText } = req.body || {};

    // Make sure the restaurant entered something

    if (!promoText || typeof promoText !== "string") {

      return res.status(400).json({

        error: "Please describe what you would like to promote.",

      });

    }

    // The API key stays securely on the server

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {

      return res.status(500).json({

        error: "AI service is not configured yet.",

      });

    }

    const prompt = `

You are a professional restaurant marketing assistant.

Create a concise marketing campaign from the restaurant's request below.

Restaurant request:

${promoText}

Return:

SOCIAL MEDIA POST:

Write an engaging social media post.

EMAIL SUBJECT:

Write one compelling email subject line.

SHORT AD COPY:

Write short promotional advertising copy.

CALL TO ACTION:

Write one clear call to action.

Do not invent prices, discounts, opening hours, addresses, or facts that the restaurant did not provide.

`;

    const response = await fetch("https://api.openai.com/v1/responses", {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

        Authorization: `Bearer ${apiKey}`,

      },

      body: JSON.stringify({

        model: "gpt-5.6-luna",

        input: prompt,

      }),

    });

    const data = await response.json();

    if (!response.ok) {

      console.error("OpenAI API error:", data);

      return res.status(500).json({

        error: "The AI service could not generate the campaign.",

      });

    }

    return res.status(200).json({

      campaign: data.output_text,

    });

  } catch (error) {

    console.error("Server error:", error);

    return res.status(500).json({

      error: "Something went wrong while generating the campaign.",

    });

  }
