export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {

    return res.status(200).end();

  }

  if (req.method !== "POST") {

    return res.status(405).json({

      error: "Method not allowed",

    });

  }

  try {

    const { promoText, campaignType = "full" } = req.body || {};

    if (!promoText || typeof promoText !== "string") {

      return res.status(400).json({

        error: "Please describe what you would like to promote.",

      });

    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {

      return res.status(500).json({

        error: "AI service is not configured yet.",

      });

    }

    const prompt = `

You are a professional restaurant marketing assistant.
You are creating marketing content for Bella Vista Bistro.

Restaurant profile:

Name: Bella Vista Bistro

Cuisine: Global Cuisine

Location: London, United Kingdom
Brand voice:

Warm, welcoming, appetising, and professional.

Write in a natural human tone, not a robotic or overly promotional tone.

Keep the language clear, engaging, and suitable for restaurant customers.

Avoid exaggerated claims, unnecessary hype, and repetitive marketing phrases

Use the restaurant name naturally when appropriate.

Do not invent information about the restaurant that has not been provided

Create the type of restaurant marketing content requested below.
Restaurant request:

${promoText}

Campaign type requested: ${campaignType}
If the campaign type is "social", return only the SOCIAL MEDIA POST.



If the campaign type is "email", return only the EMAIL CAMPAIGN.

If the campaign type is "full", return the complete marketing campaign.


Follow the relevant structure below based on the campaign type requested.

SOCIAL MEDIA POST:

Write an engaging social media post.

EMAIL CAMPAIGN:

Write one compelling email subject line followed by a concise promotional email body.

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

        model: "gpt-5.4",

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

    const campaign =

      data.output_text ||

      data.output

        ?.flatMap((item) => item.content || [])

        ?.map((item) => item.text || "")

        ?.join("")

        ?.trim();

    if (!campaign) {

      console.error("No text returned from OpenAI:", data);

      return res.status(500).json({

        error: "The AI service returned no campaign text.",

      });

    }

    return res.status(200).json({

      campaign,

    });

  } catch (error) {

    console.error("Server error:", error);

    return res.status(500).json({

      error: "Something went wrong while generating the campaign.",

    });

  }

}