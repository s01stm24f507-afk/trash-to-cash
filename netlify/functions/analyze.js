const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Ini adalah gambar sampah atau sisa. Sila kenal pasti objek ini. Kemudian, berikan cadangan yang jelas dan ringkas bagaimana cara terbaik untuk mengitar semula atau membuang sampah ini di Malaysia. Jawab dalam Bahasa Melayu dengan format yang kemas (guna bullet point).`

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key tidak dikonfigurasi.' }) }
  }

  let payload
  try {
    payload = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON tidak sah.' }) }
  }

  const { mimeType, data } = payload

  if (!mimeType || !data) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Gambar tidak diterima.' }) }
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(mimeType)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Format gambar tidak disokong.' }) }
  }

  const approxBytes = (data.length * 3) / 4
  if (approxBytes > 5 * 1024 * 1024) {
    return { statusCode: 413, body: JSON.stringify({ error: 'Gambar terlalu besar.' }) }
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: data,
                },
              },
              {
                text: PROMPT,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.4,
        },
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Gemini error:', errBody)
      return { statusCode: 502, body: JSON.stringify({ error: `Gemini API error: ${response.status}` }) }
    }

    const result = await response.json()

    const text = result?.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text)
      ?.map((p) => p.text)
      ?.join('\n')
      ?.trim()

    if (!text) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Respon AI kosong.' }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }
  } catch (error) {
    console.error('Fetch error:', error)
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Gagal memanggil AI: ' + (error.message || 'Ralat tidak diketahui.') }),
    }
  }
}
