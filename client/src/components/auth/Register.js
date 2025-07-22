import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Alert, Container, Row, Col } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PasswordSecurityChecker from './PasswordSecurityChecker';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: ''
  });
  const [alertMessage, setAlertMessage] = useState(null);
  const [passwordSecurity, setPasswordSecurity] = useState({ isSecure: true, shouldBlock: false });
  const { register, isAuthenticated, error, clearError } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
    
    if (error) {
      setAlertMessage({ type: 'danger', message: error });
      clearError();
    }
  }, [isAuthenticated, navigate, error, clearError]);

  const { username, email, password, password2 } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordSecurityCheck = (securityStatus) => {
    setPasswordSecurity(securityStatus);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== password2) {
      return setAlertMessage({ type: 'danger', message: 'Passwords do not match' });
    }

    if (passwordSecurity.shouldBlock) {
      return setAlertMessage({ 
        type: 'danger', 
        message: 'Please choose a more secure password before registering' 
      });
    }
    
    try {
      await register({
        username,
        email,
        password
      });
    } catch (err) {
      setAlertMessage({ 
        type: 'danger', 
        message: err.response?.data?.message || 'Registration failed' 
      });
    }
  };

  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={6}>
          <Card>
            <Card.Header as="h4" className="text-center">Register</Card.Header>
            <Card.Body>
              {alertMessage && (
                <Alert variant={alertMessage.type} onClose={() => setAlertMessage(null)} dismissible>
                  {alertMessage.message}
                </Alert>
              )}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group controlId="username" className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    name="username"
                    value={username}
                    onChange={handleChange}
                    placeholder="Choose a username"
                    required
                  />
                </Form.Group>

                <Form.Group controlId="email" className="mb-3">
                  <Form.Label>Email Address</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    required
                  />
                </Form.Group>

                <Form.Group controlId="password" className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={password}
                    onChange={handleChange}
                    placeholder="Create a password"
                    required
                    minLength="6"
                  />
                  <PasswordSecurityChecker 
                    password={password} 
                    onSecurityCheck={handlePasswordSecurityCheck}
                  />
                </Form.Group>

                <Form.Group controlId="password2" className="mb-4">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password2"
                    value={password2}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                    minLength="6"
                  />
                </Form.Group>

                <div className="d-grid">
                  <Button 
                    variant="primary" 
                    type="submit"
                    disabled={passwordSecurity.shouldBlock}
                  >
                    Register
                  </Button>
                </div>
              </Form>
            </Card.Body>
            <Card.Footer className="text-center">
              Already have an account? <Link to="/login">Login</Link>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Register;