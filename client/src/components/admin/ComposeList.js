import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Badge, Spinner, Alert, Modal } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faFileCode, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';

const ComposeList = () => {
  const navigate = useNavigate();
  const [composeFiles, setComposeFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [deleteModal, setDeleteModal] = useState({ show: false, compose: null });

  useEffect(() => {
    fetchComposeFiles();
  }, []);

  const fetchComposeFiles = async () => {
    try {
      const res = await axios.get('/api/admin/compose');
      setComposeFiles(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching compose files:', err);
      setError('Failed to load compose files');
      setLoading(false);
    }
  };



  const handleDelete = async () => {
    if (!deleteModal.compose) return;
    
    setActionLoading({ ...actionLoading, [deleteModal.compose._id]: 'deleting' });
    try {
      await axios.delete(`/api/admin/compose/${deleteModal.compose._id}`);
      setDeleteModal({ show: false, compose: null });
      await fetchComposeFiles();
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.response?.data?.message || 'Failed to delete');
    } finally {
      setActionLoading({ ...actionLoading, [deleteModal.compose._id]: null });
    }
  };



  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading compose files...</p>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <FontAwesomeIcon icon={faFileCode} className="me-2" />
          Docker Compose Management
        </h2>
        {/* Removed empty Button that caused syntax error */}
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      <Card>
        <Card.Body>
          {composeFiles.length === 0 ? (
            <div className="text-center py-5">
              <FontAwesomeIcon icon={faFileCode} size="3x" className="text-muted mb-3" />
              <h5>No Compose Files Yet</h5>
              <p className="text-muted">
                Create a compose file to deploy and manage game servers directly from GSM.
              </p>
              <Button 
                variant="primary" 
                onClick={() => navigate('/admin/compose/new')}
              >
                <FontAwesomeIcon icon={faPlus} className="me-2" />
                Create Your First Compose File
              </Button>
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Container</th>
                  <th>Status</th>

                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {composeFiles.map(compose => (
                  <tr key={compose._id}>
                    <td>
                      <Link to={`/admin/compose/${compose._id}`}>
                        {compose.name}
                      </Link>
                      {compose.templateName && (
                        <small className="d-block text-muted">
                          Template: {compose.templateName}
                        </small>
                      )}
                    </td>
                    <td>
                      <code>{compose.containerName || 'Not set'}</code>
                    </td>
                    <td></td>

                    <td>
                      {new Date(compose.updatedAt).toLocaleDateString()}
                    </td>
                    <td>
                      {/* Only show edit and delete in overview */}
                      
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-1"
                        onClick={() => navigate(`/admin/compose/${compose._id}`)}
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </Button>
                      
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => setDeleteModal({ show: true, compose })}
                        disabled={compose.status === 'deployed' || !!actionLoading[compose._id]}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal show={deleteModal.show} onHide={() => setDeleteModal({ show: false, compose: null })}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-danger me-2" />
            Confirm Delete
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete the compose file <strong>{deleteModal.compose?.name}</strong>?
          <br /><br />
          This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteModal({ show: false, compose: null })}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDelete}
            disabled={actionLoading[deleteModal.compose?._id] === 'deleting'}
          >
            {actionLoading[deleteModal.compose?._id] === 'deleting' ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ComposeList;
