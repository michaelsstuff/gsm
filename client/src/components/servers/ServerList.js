import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';

const ServerList = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await axios.get('/api/servers');
        setServers(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching servers:', err);
        setError('Failed to load game servers. Please try again later.');
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  const getStatusBadge = (status) => {
    let variant;
    switch (status) {
      case 'running':
        variant = 'success';
        break;
      case 'stopped':
        variant = 'danger';
        break;
      default:
        variant = 'warning';
    }
    
    return (
      <Badge bg={variant} className="ms-2">
        <span className={`status-${status} server-status`}></span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading game servers...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container>
      <h1 className="mb-4">Game Servers</h1>
      
      {servers.length === 0 ? (
        <div className="text-center mt-5">
          <p className="lead">No game servers found.</p>
        </div>
      ) : (
        <Row>
          {servers.map(server => (
            <Col key={server._id} md={4} className="mb-4">
              <Card className="server-card h-100">
                <Card.Header>
                  <h5>
                    {server.name}
                    {getStatusBadge(server.status)}
                  </h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column">
                  <div className="text-center mb-3">
                    <img 
                      src={server.logo} 
                      alt={`${server.name} logo`} 
                      className="server-logo"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/images/default-game-logo.png';
                      }}
                    />
                  </div>
                  <Card.Text>
                    <strong>Connection:</strong> {server.connectionString}
                  </Card.Text>
                  <div className="mt-auto">
                    <Link to={`/servers/${server._id}`} className="btn btn-primary w-100">
                      View Details
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
};

export default ServerList;