// actionLogController.js
const ActionLog = require('../models/action'); // Import the ActionLog model

// Controller function to get all action logs
exports.getActionLogs = async (req, res) => {
  try {
    // Optionally, you can use query parameters to filter logs (e.g., by userRole, entity, status)
    const { userRole, entity, status, startDate, endDate } = req.query;
    
    // Build the query to get action logs, applying filters if provided
    let query = {};

    if (userRole) query.userRole = userRole;
    if (entity) query.entity = entity;
    if (status) query.status = status;

    // If startDate and endDate are provided, filter logs within that date range
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate), // Greater than or equal to startDate
        $lte: new Date(endDate)    // Less than or equal to endDate
      };
    }

    // Fetch the logs from the database
    const actionLogs = await ActionLog.find(query).sort({ timestamp: -1 }); // Sort by most recent first

    // If no logs found, return a 404 response
    if (!actionLogs || actionLogs.length === 0) {
      return res.status(404).json({ message: 'No action logs found' });
    }

    // Return the logs as a response
    res.status(200).json(actionLogs);
  } catch (error) {
    console.error('Error fetching action logs:', error);
    res.status(500).json({ message: 'Error fetching action logs', error });
  }
};
