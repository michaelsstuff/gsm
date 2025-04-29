import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Alert, Container, Row, Col, Spinner } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const ServerForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState(null);
  const [availableContainers, setAvailableContainers] = useState([]);
  
  // Initialize formData without commands
  const [formData, setFormData] = useState({
    name: '',
    connectionString: '',
    logo: '/images/default-game-logo.png',
    steamAppId: '',
    websiteUrl: '',
    description: '',
    containerName: '',
  });

  useEffect(() => {
    const fetchServerData = async () => {
      // If editing, fetch the server data
      if (isEditing) {
        try {
          const res = await axios.get(`/api/admin/servers/${id}`);
          // If commands property exists, destructure it out as we don't need it
          const { commands, ...serverData } = res.data;
          setFormData(serverData);
          setLoading(false);
        } catch (err) {
          console.error('Error fetching server:', err);
          setError('Failed to load server data. Please try again later.');
          setLoading(false);
        }
      }

      // Fetch available Docker containers
      try {
        const res = await axios.get('/api/admin/containers');
        setAvailableContainers(res.data || []);
      } catch (err) {
        console.error('Error fetching containers:', err);
        // We don't set error state here because this is optional
      }
    };

    fetchServerData();
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isEditing) {
        // Update existing server
        await axios.put(`/api/admin/servers/${id}`, formData);
      } else {
        // Create new server - no longer adding commands
        await axios.post('/api/admin/servers', formData);
      }
      
      navigate('/admin');
    } catch (err) {
      console.error('Error saving server:', err);
      setError(err.response?.data?.message || 'Failed to save server. Please try again.');
      setLoading(false);
    }
  };

  if (loading && isEditing) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading server data...</p>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Link to="/admin" className="btn btn-outline-secondary mb-3">
        &larr; Back to Admin Dashboard
      </Link>
      
      <Card>
        <Card.Header as="h5">{isEditing ? 'Edit Game Server' : 'Add New Game Server'}</Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          
          <Form onSubmit={handleSubmit} className="form-container">
            <Form.Group className="mb-3" controlId="name">
              <Form.Label>Server Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Minecraft Server"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="connectionString">
              <Form.Label>Connection String</Form.Label>
              <Form.Control
                type="text"
                name="connectionString"
                value={formData.connectionString}
                onChange={handleChange}
                placeholder="e.g. play.example.com:25565 or steam://connect/192.168.1.100:27015"
                required
              />
              <Form.Text className="text-muted">
                This can be an IP:port, domain name, or connect URL depending on the game.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="containerName">
              <Form.Label>Docker Container Name</Form.Label>
              {isEditing ? (
                <Form.Control
                  type="text"
                  value={formData.containerName}
                  readOnly
                  disabled
                />
              ) : (
                <>
                  <Form.Select
                    name="containerName"
                    value={formData.containerName}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a Docker container</option>
                    {availableContainers.map(container => (
                      <option key={container.id} value={container.name}>
                        {container.name} ({container.image} - {container.state})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Only showing available containers. System containers and containers already used by other game servers are hidden.
                  </Form.Text>
                </>
              )}
            </Form.Group>

            <Form.Group className="mb-3" controlId="logo">
              <Form.Label>Logo URL</Form.Label>
              <div className="input-group">
                <Form.Control
                  type="text"
                  name="logo"
                  value={formData.logo}
                  onChange={handleChange}
                  placeholder="https://example.com/logo.png"
                />
                {formData.logo && (
                  <Button 
                    variant="outline-secondary"
                    onClick={() => {
                      window.open(formData.logo, '_blank');
                    }}
                  >
                    Test URL
                  </Button>
                )}
              </div>
              <Form.Text className="text-muted">
                Link to an image for the game server. If the image can't be loaded, a placeholder with the server initials will be shown.
              </Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="steamAppId">
                  <Form.Label>Steam App ID</Form.Label>
                  <Form.Control
                    type="text"
                    name="steamAppId"
                    value={formData.steamAppId}
                    onChange={handleChange}
                    placeholder="e.g. 730 for CS:GO"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="websiteUrl">
                  <Form.Label>Game Website URL</Form.Label>
                  <Form.Control
                    type="text"
                    name="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={handleChange}
                    placeholder="https://example.com"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3" controlId="description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
              />
            </Form.Group>

            <div className="d-grid gap-2 mt-4">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEditing ? 'Update Server' : 'Add Server'}
              </Button>
              <Link to="/admin" className="btn btn-outline-secondary">
                Cancel
              </Link>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ServerForm;