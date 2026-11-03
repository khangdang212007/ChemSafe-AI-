const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const OLLAMA_TIMEOUT_MS = 30000; // 30s timeout tránh treo request

const buildOllamaUrl = (endpoint) => {
    try {
        return new URL(endpoint, `${OLLAMA_URL}/`).toString();
    } catch {
        return `${OLLAMA_URL}/${endpoint.replace(/^\//, "")}`;
    }
};

// Middleware phân tích dữ liệu JSON và URL-encoded
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Middleware phục vụ các file frontend tĩnh từ thư mục hiện tại
app.use(express.static(__dirname));

// ================================
// HEALTH CHECK ENDPOINT
// ================================
app.get("/api/health", async (req, res) => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(buildOllamaUrl("/api/tags"), {
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
            const data = await response.json();
            const models = (data.models || []).map(m => m.name);
            const hasModel = models.some(m => m.includes(OLLAMA_MODEL.split(":")[0]));
            return res.json({
                status: "ok",
                ollama: "connected",
                model: OLLAMA_MODEL,
                modelAvailable: hasModel,
                availableModels: models
            });
        }
    } catch (err) {
        console.warn("Health check: Ollama unavailable:", err?.message || err);
    }

    res.json({
        status: "ok",
        ollama: "disconnected",
        message: `Ollama chưa được khởi động hoặc không thể kết nối tại ${OLLAMA_URL}`
    });
});

// ================================
// CHEMSAFE AI - CHAT API
// ================================
app.post("/api/chat", async (req, res) => {
    try {
        const body = req.body || {};
        const { message, history = [] } = body;
        const trimmedMessage = typeof message === "string" ? message.trim() : "";

        if (!trimmedMessage) {
            return res.status(400).json({
                error: "Tin nhắn không được để trống."
            });
        }

        if (!Array.isArray(history)) {
            return res.status(400).json({
                error: "Dữ liệu lịch sử trò chuyện không hợp lệ."
            });
        }

        // Prompt chuyên ngành Hóa học
        const systemPrompt = `Bạn là ChemSafe AI, một trợ lý AI chuyên về Hóa học và An toàn Hóa chất trường học (Chương trình GDPT 2018 và phòng thí nghiệm).

Nhiệm vụ của bạn:
1. Phân tích bài tập Hóa học và câu hỏi lý thuyết.
2. Xác định dữ kiện đề bài và yêu cầu cần tìm.
3. Chọn công thức phù hợp và viết phương trình hóa học (kèm trạng thái, điều kiện nếu có).
4. Tính toán từng bước rõ ràng, chi tiết, kèm đơn vị.
5. Kiểm tra kết quả và đưa ra kết luận.
6. Nếu đề bài thiếu dữ kiện thì phải chỉ rõ, tuyệt đối không tự bịa dữ kiện.
7. Khi liên quan đến an toàn hóa chất, độc tính hoặc phản ứng nguy hiểm, hãy nhấn mạnh cảnh báo an toàn và hướng dẫn bảo hộ (PPE/SDS).

Quy tắc trình bày khi giải bài tập:
- Dữ kiện đã cho
- Phương trình phản ứng (cân bằng chuẩn xác)
- Công thức áp dụng
- Thay số và tính toán từng bước
- Đáp số cuối cùng

Hãy trả lời bằng tiếng Việt sư phạm, dễ hiểu, súc tích và chính xác.`;

        // Giới hạn 10 tin nhắn gần nhất để giữ context tối ưu
        const recentHistory = history.slice(-10).filter(item => item && typeof item === "object");

        // Tạo cấu trúc messages gửi sang Ollama
        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            ...recentHistory.map(item => ({
                role: item.role === "bot" ? "assistant" : (typeof item.role === "string" ? item.role : "user"),
                content: String(item.content || "")
            })),
            {
                role: "user",
                content: trimmedMessage
            }
        ];

        // Thiết lập AbortController để ngăn request bị treo vô hạn
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, OLLAMA_TIMEOUT_MS);

        try {
            const ollamaResponse = await fetch(buildOllamaUrl("/api/chat"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    messages: messages,
                    stream: false
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!ollamaResponse.ok) {
                const errorText = await ollamaResponse.text();
                console.error("Ollama API Error:", errorText);
                return res.status(502).json({
                    error: `Ollama trả về lỗi (${ollamaResponse.status}): ${errorText.slice(0, 150)}`
                });
            }

            const data = await ollamaResponse.json();
            const answer = data?.message?.content || "AI không trả về câu trả lời.";

            return res.json({ answer });

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === "AbortError") {
                console.error(`Request tới Ollama bị timeout sau ${OLLAMA_TIMEOUT_MS / 1000}s`);
                return res.status(504).json({
                    error: `Quá thời gian chờ phản hồi từ Ollama AI (${OLLAMA_TIMEOUT_MS / 1000}s). Vui lòng thử lại.`
                });
            }

            console.error("Không thể kết nối với Ollama:", fetchError.message);
            return res.status(503).json({
                error: `Không thể kết nối đến Ollama tại ${OLLAMA_URL}. Vui lòng kiểm tra dịch vụ Ollama đã được bật chưa.`
            });
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({
            error: "Lỗi nội bộ máy chủ: " + (error && error.message ? error.message : String(error))
        });
    }
});

// Phục vụ trang index.html khi truy cập đường dẫn gốc
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ================================
// KHỞI ĐỘNG SERVER
// ================================
app.listen(PORT, () => {
    console.log("");
    console.log("======================================");
    console.log("       CHEMSAFE AI SERVER (OPTIMIZED)");
    console.log("======================================");
    console.log(`🌐 Website       : http://localhost:${PORT}`);
    console.log(`🤖 Ollama Service: ${OLLAMA_URL}`);
    console.log(`🧠 AI Model      : ${OLLAMA_MODEL}`);
    console.log(`⏱️ Timeout       : ${OLLAMA_TIMEOUT_MS / 1000}s`);
    console.log("======================================");
    console.log("Server đang chạy sẵn sàng...");
});
