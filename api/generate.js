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

    const { promoText, campaignType = "full", businessProfile } = req.body || {};
    const currentBusinessProfile = businessProfile || {

  name: "Bella Vista Bistro",

  cuisine: "Global Cuisine",

  location: "London, United Kingdom",

  brandVoice: "Warm, welcoming, appetising, and professional.",

};
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

You are the DEMEOS Marketing Agent, a professional business marketing intelligence assistant.

You are currently supporting the restaurant sector.

Current business profile:

 Name: ${currentBusinessProfile.name}

Cuisine: Global Cuisine

Location: London, United Kingdom
Brand voice:

Warm, welcoming, appetising, and professional.

Write in a natural human tone, not a robotic or overly promotional tone.

Keep the language clear, engaging, and suitable for restaurant customers.

Avoid exaggerated claims, unnecessary hype, and repetitive marketing phrases
Brand voice interpretation rules:

The brand voice describes HOW the marketing content should sound. It does not describe factual characteristics of the restaurant, its food, its premises, or its services.

"Warm" and "welcoming" are writing-style instructions. Do not convert them into claims such as "warm surroundings", "welcoming atmosphere", "cosy restaurant", or similar descriptions unless those facts are explicitly provided.

"Appetising" means the writing should make the explicitly provided food or promotion appealing without inventing ingredients, preparation methods, quality claims, freshness claims, flavours, textures, or other food characteristics.

"Professional" means the content should be clear, polished, credible, and appropriate for customers.

Avoid absolute or exaggerated promotional statements such as "perfect", "the best", "unmissable", "must-try", "ultimate", or similar claims unless explicitly supported by the restaurant request.

Brand voice must influence language and presentation only. It must never be treated as verified restaurant information.
Do not use subjective food-quality claims such as "delicious", "tasty", "amazing", "mouth-watering", or similar descriptions unless that description is explicitly provided in the restaurant request.

Do not infer that a promoted item is part of the permanent menu, a regular offering, or a new menu addition unless the restaurant request explicitly states this.


Verified current business information:

Name: Bella Vista Bistro

Cuisine: Global Cuisine

Location: London, United Kingdom

Only use current business facts that are explicitly provided in this prompt or in the business request.

Do not assume that the restaurant offers reservations, delivery, takeaway, discounts, special offers, specific opening hours, or other services unless they have been explicitly provided.

If a current business fact is unknown, create the marketing content without inventing or assuming it.
Use the current business name naturally when appropriate.

Do not invent information about the current business that has not been provided.
Information priority rules:

1. Treat the verified current business information above as the authoritative business profile.

2. Treat the business request below as campaign-specific information supplied for the current marketing task.

3. Campaign-specific details may be used only when they are explicitly stated in the business request.

4. Do not transform descriptive language into unsupported facts. Words such as "fresh", "award-winning", "popular", "best", "authentic", "homemade", "locally sourced", or similar claims must not be used unless explicitly provided.

5. Never create missing business facts in order to make the marketing content sound more complete.

6. When information is unavailable, omit the claim rather than guessing.

7. Keep verified business facts and campaign-specific information consistent throughout the generated content.

Create the type of business marketing content requested below.
Business request:

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

Do not invent prices, discounts, opening hours, addresses, or facts that the current business did not provide.

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

        error: "The DEMEOS Marketing Agent could not generate the marketing work.",

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

        error: "The DEMEOS Marketing Agent returned no marketing content.",

      });

    }

    return res.status(200).json({

      campaign,

    });

  } catch (error) {

    console.error("Server error:", error);

    return res.status(500).json({

      error: "Something went wrong while generating the marketing work.",

    });

  }

}