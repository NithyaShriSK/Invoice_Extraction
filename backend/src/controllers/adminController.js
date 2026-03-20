const User = require('../models/User');
const Invoice = require('../models/Invoice');

// Generate response helper
const generateResponse = (success, message, data = null) => {
  return { success, message, data };
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const searchQuery = search ? {
      $or: [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ]
    } : {};

    const users = await User.find(searchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(searchQuery);

    res.json(generateResponse(true, 'Users retrieved successfully', {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json(generateResponse(false, 'Server error retrieving users'));
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json(generateResponse(false, 'User not found'));
    }

    res.json(generateResponse(true, 'User status updated successfully', { user }));
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json(generateResponse(false, 'Server error updating user status'));
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json(generateResponse(false, 'Invalid role'));
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json(generateResponse(false, 'User not found'));
    }

    res.json(generateResponse(true, 'User role updated successfully', { user }));
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json(generateResponse(false, 'Server error updating user role'));
  }
};

// Get all invoices
const getInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const searchQuery = {};
    
    if (search) {
      searchQuery.$or = [
        { 'correctedData.invoiceNumber': { $regex: search, $options: 'i' } },
        { 'correctedData.vendorName': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      searchQuery.status = status;
    }

    const invoices = await Invoice.find(searchQuery)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Invoice.countDocuments(searchQuery);

    res.json(generateResponse(true, 'Invoices retrieved successfully', {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json(generateResponse(false, 'Server error retrieving invoices'));
  }
};

// Get system analytics
const getAnalytics = async (req, res) => {
  try {
    // User stats
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          adminUsers: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } }
        }
      }
    ]);

    // Invoice stats
    const invoiceStats = await Invoice.aggregate([
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          completedInvoices: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          averageAccuracy: { $avg: '$accuracyScore' },
          totalAmount: { $sum: '$correctedData.totalAmount' },
          averageProcessingTime: { $avg: '$processingTime' }
        }
      }
    ]);

    // Monthly trends
    const monthlyTrends = await Invoice.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          invoiceCount: { $sum: 1 },
          totalAmount: { $sum: '$correctedData.totalAmount' },
          averageAccuracy: { $avg: '$accuracyScore' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Accuracy distribution
    const accuracyDistribution = await Invoice.aggregate([
      {
        $bucket: {
          groupBy: '$accuracyScore',
          boundaries: [0, 50, 70, 85, 95, 100],
          default: 'other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Language distribution
    const languageDistribution = await Invoice.aggregate([
      {
        $group: {
          _id: '$languageDetected',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Vendor stats
    const vendorStats = await Invoice.aggregate([
      {
        $group: {
          _id: '$correctedData.vendorName',
          count: { $sum: 1 },
          totalAmount: { $sum: '$correctedData.totalAmount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // New users this month
    const newUsersThisMonth = await User.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });

    const analytics = {
      userStats: {
        totalUsers: userStats[0]?.totalUsers || 0,
        activeUsers: userStats[0]?.activeUsers || 0,
        adminUsers: userStats[0]?.adminUsers || 0,
        newUsersThisMonth
      },
      invoiceStats: {
        totalInvoices: invoiceStats[0]?.totalInvoices || 0,
        completedInvoices: invoiceStats[0]?.completedInvoices || 0,
        averageAccuracy: invoiceStats[0]?.averageAccuracy || 0,
        totalAmount: invoiceStats[0]?.totalAmount || 0,
        averageProcessingTime: invoiceStats[0]?.averageProcessingTime || 0
      },
      monthlyTrends,
      accuracyDistribution,
      languageDistribution,
      vendorStats
    };

    res.json(generateResponse(true, 'Analytics retrieved successfully', { analytics }));
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json(generateResponse(false, 'Server error retrieving analytics'));
  }
};

// Get system health
const getSystemHealth = async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Recent activity
    const recentActivity = await Promise.all([
      Invoice.countDocuments({ createdAt: { $gte: last24Hours } }),
      User.countDocuments({ createdAt: { $gte: last24Hours } })
    ]);

    // Performance metrics
    const performance = await Invoice.aggregate([
      { $match: { createdAt: { $gte: last24Hours } } },
      {
        $group: {
          _id: null,
          averageProcessingTime: { $avg: '$processingTime' },
          averageAccuracy: { $avg: '$accuracyScore' },
          errorRate: {
            $avg: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      metrics: {
        performance: {
          averageProcessingTime: performance[0]?.averageProcessingTime || 0,
          averageAccuracy: performance[0]?.averageAccuracy || 0,
          errorRate: (performance[0]?.errorRate || 0) * 100
        },
        recentActivity: {
          invoicesLast24Hours: recentActivity[0],
          usersLast24Hours: recentActivity[1]
        }
      },
      timestamp: now.toISOString()
    };

    res.json(generateResponse(true, 'System health retrieved successfully', { health }));
  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json(generateResponse(false, 'Server error retrieving system health'));
  }
};

module.exports = {
  getUsers,
  updateUserStatus,
  updateUserRole,
  getInvoices,
  getAnalytics,
  getSystemHealth
};
