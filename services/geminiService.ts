import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
// NOTE: In a production environment, you should never expose API keys on the client side.
// This requires a proxy or server-side implementation.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes page thumbnails to detect logical split points (like chapter starts).
 * Returns an array of page indices (0-based) where a split should occur.
 */
export const analyzeSplitPoints = async (
  pageThumbnails: string[]
): Promise<number[]> => {
  try {
    // We will send a subset of pages or reduced quality if many pages to fit context,
    // but Gemini 1.5/2.5 Flash has a large context window.
    // For this demo, we assume we send base64 images.
    
    // Prepare parts: Text prompt + Images
    const parts: any[] = [];
    
    parts.push({
      text: `Bạn là một trợ lý AI chuyên xử lý tài liệu.
      Nhiệm vụ: Xem xét các hình ảnh trang tài liệu PDF dưới đây theo thứ tự.
      Hãy xác định các trang bắt đầu của một phần mới, chương mới, hoặc một tài liệu độc lập (ví dụ: hóa đơn khác nhau).
      
      Trả về kết quả dưới dạng JSON chứa danh sách các số trang (pageNumber bắt đầu từ 1) là điểm bắt đầu của các phần này.
      Luôn luôn bao gồm trang 1.
      `
    });

    // Add images (limit to first 20 for this demo to avoid payload size limits in browser environment if excessive)
    // In real app, you might chunk this.
    const limitedThumbnails = pageThumbnails.slice(0, 50); 
    
    limitedThumbnails.forEach((dataUrl, index) => {
      // Remove data:image/jpeg;base64, prefix
      const base64Data = dataUrl.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      });
      parts.push({ text: `Page ${index + 1}` });
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            startPages: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Danh sách số trang bắt đầu các phần mới (1-based index)"
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    const startPages: number[] = json.startPages || [1];

    // Convert 1-based page numbers to 0-based indices
    return startPages.map((p) => Math.max(0, p - 1));

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Không thể phân tích tài liệu bằng AI lúc này.");
  }
};

/**
 * Suggests a concise, professional file name based on document content using Gemini.
 */
export const suggestFileNameWithAI = async (
  pageThumbnails: string[],
  originalName: string
): Promise<string> => {
  try {
    const parts: any[] = [];
    parts.push({
      text: `Bạn là trợ lý AI chuyên xử lý tài liệu.
      Nhiệm vụ: Xem xét các trang tài liệu PDF dưới đây (tên gốc hiện tại: "${originalName}").
      Hãy gợi ý một TÊN FILE mới ngắn gọn, chuyên nghiệp, phản ánh chính xác nội dung chính của tài liệu (không chứa ký tự đặc biệt, dùng dấu gạch dưới '_' thay khoảng trắng, không có đuôi .pdf, dài tối đa 6 từ).
      Ví dụ: Hop_dong_thue_nha_2024, Bao_cao_doanh_thu_Q1, De_thi_toan_12.
      
      Trả về kết quả dưới dạng JSON chứa thuộc tính fileName.
      `
    });

    const limitedThumbnails = pageThumbnails.slice(0, 5);
    limitedThumbnails.forEach((dataUrl, index) => {
      const base64Data = dataUrl.split(',')[1];
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        });
        parts.push({ text: `Page ${index + 1}` });
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fileName: {
              type: Type.STRING,
              description: "Tên file gợi ý gọn gàng, chuyên nghiệp (không bao gồm đuôi .pdf)"
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return json.fileName || "Tai_lieu_PDF";
  } catch (error) {
    console.error("Gemini Naming Error:", error);
    throw new Error("Không thể đặt tên tự động bằng AI lúc này.");
  }
};