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
      text: `Bạn là trợ lý AI chuyên chuẩn hóa tên file tài liệu.
      Nhiệm vụ: Dựa vào tên gốc hiện tại ("${originalName}") và ảnh nội dung (nếu có), hãy gợi ý một TÊN FILE mới ngắn gọn, chuyên nghiệp, rõ ràng (dùng dấu gạch dưới '_' thay khoảng trắng, không chứa ký tự đặc biệt, không kèm phần mở rộng như .pdf, .docx, .xlsx, dài tối đa 8 từ).
      Ví dụ: Hop_dong_thue_nha_2026, Bao_cao_doanh_thu_Q1, Danh_sach_hoc_sinh_10A1.
      
      Trả về kết quả dưới dạng JSON chứa thuộc tính fileName.
      `
    });

    const limitedThumbnails = pageThumbnails.slice(0, 2);
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

/**
 * Suggests batch file names for multiple documents in 1 single Gemini API call.
 * This is 10x-15x faster than sequential per-file AI calls.
 */
export const suggestBatchFileNamesWithAI = async (
  items: { id: string; originalName: string; thumbnail?: string | null }[]
): Promise<Record<string, string>> => {
  try {
    const parts: any[] = [];
    parts.push({
      text: `Bạn là trợ lý AI chuyên chuẩn hóa tên file tài liệu hàng loạt siêu tốc.
      Nhiệm vụ: Dựa vào danh sách các file tài liệu dưới đây (tên gốc và ảnh trang đầu nếu có), hãy gợi ý TÊN FILE mới chuẩn chuyên nghiệp cho từng file.
      Quy tắc đặt tên:
      - Ngắn gọn, rõ ràng, dài tối đa 8 từ.
      - Dùng dấu gạch dưới '_' thay cho khoảng trắng, không chứa ký tự đặc biệt, không kèm đuôi file (.pdf, .docx, .xlsx...).
      - Ví dụ: Hop_dong_thue_nha_2026, Bao_cao_doanh_thu_Q1, Danh_sach_hoc_sinh_10A1.
      
      Trả về JSON object mapping giữa id file và fileName mới gợi ý: { "id1": "Ten_Moi_1", "id2": "Ten_Moi_2" }
      `
    });

    items.forEach((item) => {
      parts.push({ text: `File ID: "${item.id}" | Tên gốc: "${item.originalName}"` });
      if (item.thumbnail) {
        const base64Data = item.thumbnail.split(',')[1];
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          });
          parts.push({ text: `[Ảnh trang 1 của file ID "${item.id}"]` });
        }
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      }
    });

    const json = JSON.parse(response.text || "{}");
    return json;
  } catch (error) {
    console.error("Gemini Batch Naming Error:", error);
    throw new Error("Không thể đặt tên tự động hàng loạt bằng AI lúc này.");
  }
};

/**
 * Suggests short, meaningful filenames for a list of pages/sections (e.g. chapters, lessons, sections)
 * based on their thumbnail images using Gemini.
 * Returns a mapping of pageNumber (1-based) to suggested filename.
 */
export const suggestChapterNamesWithAI = async (
  pages: { pageNumber: number; thumbnailUrl: string; isBlank?: boolean }[],
  originalName: string
): Promise<Record<number, string>> => {
  try {
    const parts: any[] = [];
    parts.push({
      text: `Bạn là trợ lý AI chuyên xử lý tài liệu PDF.
      Nhiệm vụ: Dưới đây là danh sách các trang tài liệu PDF của file "${originalName}" sẽ được tách thành các file riêng biệt.
      Hãy xem ảnh thu nhỏ của từng trang và đề xuất TÊN FILE NGẮN GỌN, CHUYÊN NGHIỆP cho mỗi trang/chương đó (không ký tự đặc biệt, dùng gạch dưới '_' thay khoảng trắng, tối đa 6 từ, có đánh số thứ tự 01_, 02_, 03_ ở đầu để dễ sắp xếp).
      Ví dụ: 01_Gioi_thieu, 02_Chuong_1_Hinh_hoc, 03_Bai_tap, 04_Phu_luc...
      
      Trả về kết quả dưới dạng JSON là một Object, với key là số trang (pageNumber dưới dạng string "1", "2"...) và value là tên file đề xuất (không kèm đuôi .pdf).
      Ví dụ format JSON mong muốn:
      {
        "1": "01_Gioi_thieu",
        "2": "02_Chuong_1_Hinh_hoc"
      }
      `
    });

    const limitedPages = pages.slice(0, 25);
    limitedPages.forEach((p) => {
      if (p.isBlank || !p.thumbnailUrl) return;
      const base64Data = p.thumbnailUrl.split(',')[1];
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        });
        parts.push({ text: `Page ${p.pageNumber}` });
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json"
      }
    });

    const json = JSON.parse(response.text || "{}");
    const result: Record<number, string> = {};
    for (const key in json) {
      const pageNum = parseInt(key, 10);
      if (!isNaN(pageNum) && typeof json[key] === 'string') {
        const cleanName = json[key].replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        if (cleanName) {
          result[pageNum] = cleanName;
        }
      }
    }
    return result;
  } catch (error) {
    console.error("Gemini Chapter Naming Error:", error);
    return {};
  }
};