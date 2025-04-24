import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <Container>
      <Row className="mb-5">
        <Col className="text-center">
          <h1 className="display-4 mb-3">Game Server Management</h1>
          <p className="lead">
            Monitor and manage your game servers running in Docker containers.
          </p>
          <Link to="/servers">
            <Button variant="primary" size="lg">View Game Servers</Button>
          </Link>
        </Col>
      </Row>
      
      <Row>
        <Col md={4} className="mb-4">
          <Card className="h-100">
            <Card.Body>
              <Card.Title><i className="bi bi-hdd-rack me-2"></i>Server Status</Card.Title>
              <Card.Text>
                View real-time status of your game servers, including whether they're running, stopped, or experiencing issues.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4} className="mb-4">
          <Card className="h-100">
            <Card.Body>
              <Card.Title><i className="bi bi-person-lock me-2"></i>Admin Control</Card.Title>
              <Card.Text>
                Administrators can start, stop, and backup game servers with pre-configured commands.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4} className="mb-4">
          <Card className="h-100">
            <Card.Body>
              <Card.Title><i className="bi bi-info-circle me-2"></i>Server Information</Card.Title>
              <Card.Text>
                Access connection details, Steam links, and other important information about your game servers.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Home;