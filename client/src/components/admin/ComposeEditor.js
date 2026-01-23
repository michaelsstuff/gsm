import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Spinner, Row, Col, Badge, Modal } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave, faPlay, faCheck, faExclamationTriangle, faTerminal, faFileCode } from '@fortawesome/free-solid-svg-icons';
import AceEditor from 'react-ace';
import axios from 'axios';

import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-github';

const ComposeEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    templateName: null
  });
  
  const [composeFile, setComposeFile] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch templates for new files
      if (!isEditing) {
        try {
          const res = await axios.get('/api/admin/templates');
          setTemplates(res.data);
        } catch (err) {
          console.error('Error fetching templates:', err);
        }
      }
      
      // Fetch existing compose file
      if (isEditing) {
        try {
          const res = await axios.get(`/api/admin/compose/${id}`);
          setComposeFile(res.data);
          setFormData({
            name: res.data.name,
            content: res.data.content,
            templateName: res.data.templateName
          });
          setLoading(false);
        } catch (err) {
          console.error('Error fetching compose file:', err);
          setError('Failed to load compose file');
          setLoading(false);
        }
      }
    };
    
    fetchData();
  }, [id, isEditing]);

  const handleTemplateSelect = async (e) => {
    const templateId = e.target.value;
    if (!templateId) return;
    
    try {
      const res = await axios.get(`/api/admin/templates/${templateId}`);
      setFormData({
        ...formData,
        name: formData.name || res.data.name,
        content: res.data.content,
        templateName: res.data.id
      });
      setValidationResult(null);
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load template');
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    
    try {
      const res = await axios.post('/api/admin/compose/validate-content', {
        content: formData.content
      });
      setValidationResult(res.data);
    } catch (err) {
      console.error('Validation error:', err);
      setValidationResult({
        valid: false,
        errors: [err.response?.data?.message || 'Validation failed']
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (isEditing) {
        await axios.put(`/api/admin/compose/${id}`, formData);
        setSuccess('Compose file saved successfully');
      } else {
        const res = await axios.post('/api/admin/compose', formData);
        navigate(`/admin/compose/${res.data.composeFile._id}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.response?.data?.message || 'Failed to save');
      if (err.response?.data?.errors) {
        setValidationResult({
          valid: false,
          errors: err.response.data.errors,
          warnings: err.response.data.warnings
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await axios.post(`/api/admin/compose/${id}/deploy`);
      setSuccess('Deployment successful!');
      setComposeFile(res.data.composeFile);
    } catch (err) {
      console.error('Deploy error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleUndeploy = async () => {
    setDeploying(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await axios.post(`/api/admin/compose/${id}/undeploy`);
      setSuccess('Undeploy successful');
      setComposeFile(res.data.composeFile);
    } catch (err) {
      console.error('Undeploy error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Undeploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleRedeploy = async () => {
    setDeploying(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await axios.post(`/api/admin/compose/${id}/redeploy`, {
        content: formData.content
      });
      setSuccess('Redeploy successful!');
      setComposeFile(res.data.composeFile);
    } catch (err) {
      console.error('Redeploy error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Redeploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await axios.get(`/api/admin/compose/${id}/logs?lines=200`);
      setLogs(res.data.logs);
    } catch (err) {
      setLogs('Failed to fetch logs: ' + (err.response?.data?.message || err.message));
    } finally {
      setLogsLoading(false);
    }
  };

  const handleShowLogs = () => {
    setShowLogsModal(true);
    fetchLogs();
  };



  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading compose file...</p>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Link to="/admin/compose" className="btn btn-outline-secondary mb-3">
        <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
        Back to Compose Files
      </Link>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <FontAwesomeIcon icon={faFileCode} className="me-2" />
            {isEditing ? `Edit: ${composeFile?.name}` : 'Create New Compose File'}
          </h5>

        </Card.Header>
        
        <Card.Body>
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
              {success}
            </Alert>
          )}

          <Form onSubmit={handleSave}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. My Minecraft Server"
                    required
                  />
                </Form.Group>
              </Col>
              
              {!isEditing && (
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Start from Template</Form.Label>
                    <Form.Select onChange={handleTemplateSelect}>
                      <option value="">Select a template...</option>
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              )}
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Docker Compose Content</Form.Label>
              <AceEditor
                mode="yaml"
                theme="monokai"
                name="compose-editor"
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                width="100%"
                height="400px"
                fontSize={14}
                showPrintMargin={false}
                showGutter={true}
                highlightActiveLine={true}
                setOptions={{
                  enableBasicAutocompletion: true,
                  enableLiveAutocompletion: false,
                  showLineNumbers: true,
                  tabSize: 2,
                }}
              />
            </Form.Group>

            {/* Validation Results */}
            {validationResult && (
              <Alert variant={validationResult.valid ? 'success' : 'danger'} className="mb-3">
                {validationResult.valid ? (
                  <>
                    <FontAwesomeIcon icon={faCheck} className="me-2" />
                    Compose file is valid
                    {validationResult.containerName && (
                      <span className="ms-2">
                        (Container: <code>{validationResult.containerName}</code>)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <strong>Validation Errors:</strong>
                    <ul className="mb-0 mt-2">
                      {validationResult.errors?.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </>
                )}
                
                {validationResult.warnings?.length > 0 && (
                  <div className="mt-2">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-warning me-2" />
                    <strong>Warnings:</strong>
                    <ul className="mb-0 mt-1">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="d-flex gap-2 flex-wrap">
              <Button
                variant="outline-secondary"
                onClick={handleValidate}
                disabled={validating || !formData.content}
              >
                {validating ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Validating...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCheck} className="me-2" />
                    Validate
                  </>
                )}
              </Button>

              <Button
                variant="primary"
                type="submit"
                disabled={saving || !formData.name || !formData.content || composeFile?.status === 'deployed'}
              >
                {saving ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faSave} className="me-2" />
                    Save
                  </>
                )}
              </Button>


              {isEditing && (
                <>
                  <Button
                    variant="success"
                    onClick={handleDeploy}
                    disabled={deploying}
                  >
                    {deploying ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPlay} className="me-2" />
                        Deploy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this compose file?')) {
                        try {
                          await axios.delete(`/api/admin/compose/${id}`);
                          navigate('/admin/compose');
                        } catch (err) {
                          setError(err.response?.data?.message || 'Failed to delete compose file');
                        }
                      }
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>

            {/* Compose File Info */}
            {composeFile && (
              <Card className="mt-4">
                <Card.Header>Compose File Details</Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4}>
                      <strong>Container Name:</strong>
                      <br />
                      <code>{composeFile.containerName || 'Not set'}</code>
                    </Col>
                    <Col md={4}>
                      <strong>Version:</strong>
                      <br />
                      {composeFile.version}
                    </Col>
                    <Col md={4}>
                      <strong>Deployed At:</strong>
                      <br />
                      {composeFile.deployedAt 
                        ? new Date(composeFile.deployedAt).toLocaleString() 
                        : 'Never'}
                    </Col>
                  </Row>
                  
                  {composeFile.lastError && (
                    <Alert variant="danger" className="mt-3 mb-0">
                      <strong>Last Error:</strong> {composeFile.lastError}
                    </Alert>
                  )}
                  

                </Card.Body>
              </Card>
            )}
          </Form>
        </Card.Body>
      </Card>

      {/* Logs Modal */}
      <Modal show={showLogsModal} onHide={() => setShowLogsModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <FontAwesomeIcon icon={faTerminal} className="me-2" />
            Container Logs
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {logsLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
              <p className="mt-2">Loading logs...</p>
            </div>
          ) : (
            <pre 
              className="bg-dark text-light p-3 rounded" 
              style={{ 
                maxHeight: '500px', 
                overflow: 'auto',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {logs || 'No logs available'}
            </pre>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLogsModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={fetchLogs} disabled={logsLoading}>
            Refresh
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ComposeEditor;
