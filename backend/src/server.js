import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
const app = express();
app.use(helmet());
app.use(cors({
    origin: "http://localhost:8000",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true
}))

app.use(morgan("dev"));
app.use(express.json());
const PORT = process.env.PORT || 3000;
app.get("/health", (req, res) => {
    res.send({
        status: "ok",
        service: "Ai-Gov",
        message: "API is running fine"
    })
    console.log("App Health is fine!!.")
})
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})