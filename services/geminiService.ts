
import { GoogleGenAI, Type } from "@google/genai";
import { CorrectionResult, EssayInput, Topic } from "../types";

const cleanJsonString = (str: string) => {
  if (!str) return "{}";
  let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
};

export const generateCustomTopic = async (userInterest: string): Promise<Topic> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: [{ text: `Tema solicitado: ${userInterest}` }],
      config: {
        systemInstruction: "Aja como gerador instantâneo de temas ENEM. Forneça um título e 2 textos de apoio curtos com dados. Saída: JSON estrito.",
        responseMimeType: "application/json",
        temperature: 0.2, // Minimizando criatividade para máxima velocidade
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            supportTexts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  icon: { type: Type.STRING }
                },
                required: ["id", "title", "content", "icon"]
              }
            }
          },
          required: ["title", "supportTexts"]
        }
      }
    });

    const result = JSON.parse(cleanJsonString(response.text));
    return {
      id: crypto.randomUUID(),
      title: result.title,
      supportTexts: result.supportTexts
    };
  } catch (error: any) {
    console.error("Erro detalhado:", error);
    throw new Error(`Erro ao gerar tema rápido: ${error.message}`);
  }
};

export const correctEssay = async (topicTitle: string, input: EssayInput): Promise<CorrectionResult> => {
  if (!process.env.API_KEY) {
    console.error("API Key missing!");
  } else {
    console.log("Gemini Service: API Key configured successfully.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `Você é a banca examinadora oficial do ENEM, extremamente rigorosa quanto à autoria.

  TAREFA CRÍTICA 1: DETECÇÃO DE I.A. (ANTI-PLÁGIO)
  Analise o texto procurando padrões de LLMs (como ChatGPT, Claude, etc):
  1. Perfeição sintática robótica sem a "voz" natural ou pequenos deslizes de um estudante.
  2. Uso excessivo e mecânico de conectivos de transição ("Ademais", "Em suma", "Nesse viés").
  3. Estrutura de parágrafos excessivamente simétrica e previsível.
  4. Vocabulário polido, genérico e sem marcas de oralidade ou personalidade.

  SE DETECTAR I.A. (Probabilidade > 80%):
  - PARE A AVALIAÇÃO IMEDIATAMENTE.
  - Defina "totalScore": 0.
  - Defina "aiDetected": true.
  - Defina "aiJustification": "ANULAÇÃO POR AUTORIA: O texto apresenta padrões sintáticos e estruturais característicos de Inteligência Artificial Generativa. A redação foi zerada por violação da política de autoria própria exigida no exame."
  - Nas "competencies", atribua nota 0 para todas e no feedback coloque: "Anulado por uso de IA".
  - "generalComment": "Texto anulado."

  SE FOR HUMANO:
  - Avalie as 5 competências do ENEM (0-200 pontos cada) com rigor técnico.
  - "aiDetected": false.
  - Calcule o totalScore (soma das 5 competências).

  Retorne estritamente o JSON conforme o schema.`;

  let parts: any[] = [];
  if (input.type === 'text') {
    parts = [{ text: `TEXTO DO ALUNO (Tema: ${topicTitle}):\n${input.content}` }];
  } else {
    parts = [
      { text: `Analise a imagem da redação manuscrita sobre o tema: ${topicTitle}` },
      { inlineData: { mimeType: input.mimeType, data: input.base64 } }
    ];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalScore: { type: Type.NUMBER },
            aiDetected: { type: Type.BOOLEAN },
            aiJustification: { type: Type.STRING },
            competencies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  feedback: { type: Type.STRING }
                },
                required: ["name", "score", "feedback"]
              }
            },
            generalComment: { type: Type.STRING }
          },
          required: ["totalScore", "competencies", "generalComment", "aiDetected"]
        }
      },
    });

    return JSON.parse(cleanJsonString(response.text)) as CorrectionResult;

  } catch (error: any) {
    console.error("Erro na apuração:", error.message);
    throw new Error(`Falha ao gerar apuração: ${error.message}`);
  }
};
