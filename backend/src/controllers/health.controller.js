const getHealth = (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Bloom API is running"
    });
};

module.exports = {
    getHealth
};
