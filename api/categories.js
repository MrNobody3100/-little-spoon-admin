export default function handler(req, res) {
    console.log("CATEGORIES API CALLED");
    console.log("METHOD:", req.method);

    res.status(200).json({
        success: true,
        message: "API works",
        method: req.method
    });
}
