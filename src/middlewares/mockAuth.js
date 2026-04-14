const mockAuth = (req, res, next) => {
  req.user = {
    id: 1,
    name: 'UserMock',
    email: 'mock@projetozup.com',
    role: 'admin',
  };

  next();
};

module.exports = mockAuth;
