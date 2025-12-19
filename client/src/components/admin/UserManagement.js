import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Button, Badge, Spinner, Alert, Card, Modal, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/admin/users');
        setUsers(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again later.');
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleOpenRoleModal = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const handleCloseRoleModal = () => {
    setShowRoleModal(false);
    setSelectedUser(null);
    setNewRole('');
  };

  const handleRoleChange = (e) => {
    setNewRole(e.target.value);
  };

  const handleRoleUpdate = async () => {
    try {
      setUpdateLoading(true);
      
      const res = await axios.put(`/api/admin/users/${selectedUser._id}/role`, {
        role: newRole
      });
      
      // Update user in state
      setUsers(users.map(user => 
        user._id === selectedUser._id 
          ? { ...user, role: newRole } 
          : user
      ));
      
      setSuccessMessage(`User ${selectedUser.username}'s role updated to ${newRole}`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      
      handleCloseRoleModal();
      setUpdateLoading(false);
    } catch (err) {
      console.error('Error updating user role:', err);
      setError(err.response?.data?.message || 'Failed to update user role. Please try again.');
      setUpdateLoading(false);
    }
  };

  const handleOpenDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedUser(null);
  };

  const handleDeleteUser = async () => {
    try {
      setDeleteLoading(true);
      
      await axios.delete(`/api/admin/users/${selectedUser._id}`);
      
      // Remove user from state
      setUsers(users.filter(user => user._id !== selectedUser._id));
      
      setSuccessMessage(`User ${selectedUser.username} deleted successfully`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      
      handleCloseDeleteModal();
      setDeleteLoading(false);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.response?.data?.message || 'Failed to delete user. Please try again.');
      setDeleteLoading(false);
      handleCloseDeleteModal();
    }
  };

  const getRoleBadge = (role) => {
    return role === 'admin' 
      ? <Badge bg="primary">Administrator</Badge>
      : <Badge bg="secondary">User</Badge>;
  };

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading users...</p>
      </Container>
    );
  }

  return (
    <Container>
      <Row className="mb-4 align-items-center">
        <Col>
          <h1>User Management</h1>
        </Col>
        <Col xs="auto">
          <Link to="/admin" className="btn btn-outline-secondary">
            Back to Admin Dashboard
          </Link>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage(null)} dismissible>
          {successMessage}
        </Alert>
      )}

      <Card>
        <Card.Header as="h5">Registered Users</Card.Header>
        <Card.Body>
          {users.length === 0 ? (
            <div className="text-center p-4">
              <p className="mb-3">No registered users found.</p>
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Registration Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{getRoleBadge(user.role)}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        onClick={() => handleOpenRoleModal(user)}
                        disabled={currentUser._id === user._id}
                        title={currentUser._id === user._id ? "You cannot change your own role" : "Change user role"}
                        className="me-2"
                      >
                        Change Role
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm" 
                        onClick={() => handleOpenDeleteModal(user)}
                        disabled={currentUser._id === user._id}
                        title={currentUser._id === user._id ? "You cannot delete your own account" : "Delete user"}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Role Change Modal */}
      <Modal show={showRoleModal} onHide={handleCloseRoleModal}>
        <Modal.Header closeButton>
          <Modal.Title>Change User Role</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <>
              <p>
                Change role for user: <strong>{selectedUser.username}</strong>
              </p>
              <Form.Group className="mb-3">
                <Form.Label>Role</Form.Label>
                <Form.Select
                  value={newRole}
                  onChange={handleRoleChange}
                >
                  <option value="user">User</option>
                  <option value="admin">Administrator</option>
                </Form.Select>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseRoleModal}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleRoleUpdate} 
            disabled={updateLoading || (selectedUser && selectedUser.role === newRole)}
          >
            {updateLoading ? 'Updating...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={handleCloseDeleteModal}>
        <Modal.Header closeButton>
          <Modal.Title>Delete User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <>
              <Alert variant="warning">
                <strong>Warning:</strong> This action cannot be undone!
              </Alert>
              <p>
                Are you sure you want to delete the user <strong>{selectedUser.username}</strong>?
              </p>
              <p className="text-muted mb-0">
                Email: {selectedUser.email}
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteUser} 
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Delete User'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UserManagement;