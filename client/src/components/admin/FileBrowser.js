import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Button, Alert, 
  Breadcrumb, ListGroup, Spinner, Modal
} from 'react-bootstrap';
import axios from 'axios';
import AceEditor from 'react-ace';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFolder, faFile, faArrowLeft, faSave, 
  faEdit, faTrashAlt, faFolderOpen, faFileCode, 
  faFileAlt, faHome, faDatabase, faHdd
} from '@fortawesome/free-solid-svg-icons';

// Import ace modes (languages) and themes
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/mode-xml';
import 'ace-builds/src-noconflict/mode-php';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/mode-ruby';
import 'ace-builds/src-noconflict/mode-css';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-sh';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/ext-language_tools';

const FileBrowser = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [server, setServer] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [volumes, setVolumes] = useState([]);
  const [inVolumesView, setInVolumesView] = useState(true);
  const [selectedVolume, setSelectedVolume] = useState(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [editorMode, setEditorMode] = useState('text');
  const [editorTheme, setEditorTheme] = useState('monokai');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchServerDetails = async () => {
      try {
        const res = await axios.get(`/api/admin/servers/${id}`);
        setServer(res.data);
        fetchVolumes();
      } catch (err) {
        console.error('Error fetching server details:', err);
        setError('Failed to load server details. Please try again later.');
        setLoading(false);
      }
    };

    fetchServerDetails();
  }, [id]);

  const fetchVolumes = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/admin/servers/${id}/volumes`);
      setVolumes(res.data.volumes);
      setInVolumesView(true);
      setSelectedVolume(null);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching volumes:', err);
      setError(`Failed to load volumes: ${err.response?.data?.message || 'Unknown error'}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Update breadcrumbs when path changes
    if (!inVolumesView && selectedVolume && currentPath) {
      const pathParts = currentPath.split('/').filter(Boolean);
      const crumbs = [
        { 
          name: 'Volumes', 
          path: null,
          isVolumeRoot: true
        },
        {
          name: selectedVolume.name,
          path: selectedVolume.destination,
          isVolumeRoot: false
        }
      ];
      
      let buildPath = selectedVolume.destination;
      pathParts.forEach(part => {
        if (part === selectedVolume.destination.split('/').pop()) return; // Skip if it's already in the volume name
        
        buildPath += '/' + part;
        crumbs.push({
          name: part,
          path: buildPath,
          isVolumeRoot: false
        });
      });
      
      setBreadcrumbs(crumbs);
    } else {
      setBreadcrumbs([
        { 
          name: 'Volumes', 
          path: null,
          isVolumeRoot: true
        }
      ]);
    }
  }, [currentPath, inVolumesView, selectedVolume]);

  const fetchDirectoryContents = async (path) => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/admin/servers/${id}/files`, {
        params: { path }
      });
      
      // Sort files: directories first, then files, both alphabetically
      const sortedFiles = res.data.files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setCurrentPath(res.data.path);
      setFiles(sortedFiles);
      setInVolumesView(false);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching directory contents:', err);
      setError(`Failed to load directory contents: ${err.response?.data?.message || 'Unknown error'}`);
      setLoading(false);
    }
  };

  const handleVolumeClick = (volume) => {
    setSelectedVolume(volume);
    fetchDirectoryContents(volume.destination);
  };

  const handleFileClick = async (file) => {
    if (file.isDirectory) {
      // Navigate to directory
      fetchDirectoryContents(file.path);
    } else {
      // Open file
      try {
        setLoading(true);
        const res = await axios.get(`/api/admin/servers/${id}/files/content`, {
          params: { path: file.path }
        });
        
        // Detect file type and set editor mode
        const extension = file.name.split('.').pop().toLowerCase();
        let mode = 'text';
        
        switch (extension) {
          case 'js':
            mode = 'javascript';
            break;
          case 'json':
            mode = 'json';
            break;
          case 'yml':
          case 'yaml':
            mode = 'yaml';
            break;
          case 'xml':
            mode = 'xml';
            break;
          case 'php':
            mode = 'php';
            break;
          case 'py':
            mode = 'python';
            break;
          case 'java':
            mode = 'java';
            break;
          case 'rb':
            mode = 'ruby';
            break;
          case 'css':
            mode = 'css';
            break;
          case 'html':
            mode = 'html';
            break;
          case 'sh':
          case 'bash':
            mode = 'sh';
            break;
          default:
            mode = 'text';
        }
        
        setEditorMode(mode);
        setCurrentFile(file);
        setFileContent(res.data.content);
        setShowEditor(true);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching file content:', err);
        setError(`Failed to load file content: ${err.response?.data?.message || 'Unknown error'}`);
        setLoading(false);
      }
    }
  };

  const handleBreadcrumbClick = (crumb) => {
    if (crumb.isVolumeRoot) {
      // Return to volumes view
      setInVolumesView(true);
      setSelectedVolume(null);
      setCurrentPath('');
    } else {
      fetchDirectoryContents(crumb.path);
    }
  };

  const handleSaveFile = async () => {
    try {
      setIsSaving(true);
      await axios.post(`/api/admin/servers/${id}/files/save`, {
        path: currentFile.path,
        content: fileContent
      });
      
      setSuccessMessage(`File ${currentFile.name} saved successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setIsSaving(false);
    } catch (err) {
      console.error('Error saving file:', err);
      setError(`Failed to save file: ${err.response?.data?.message || 'Unknown error'}`);
      setIsSaving(false);
    }
  };

  const closeEditor = () => {
    setShowEditor(false);
    setCurrentFile(null);
    setFileContent('');
  };

  const getFileIcon = (file) => {
    if (file.isDirectory) {
      return <FontAwesomeIcon icon={faFolderOpen} className="me-2 text-warning" />;
    }
    
    const extension = file.name.split('.').pop().toLowerCase();
    switch (extension) {
      case 'js':
      case 'php':
      case 'py':
      case 'java':
      case 'rb':
      case 'html':
      case 'css':
      case 'xml':
      case 'json':
      case 'yml':
      case 'yaml':
        return <FontAwesomeIcon icon={faFileCode} className="me-2 text-info" />;
      default:
        return <FontAwesomeIcon icon={faFileAlt} className="me-2 text-secondary" />;
    }
  };

  if (loading && !server) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading server details...</p>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Link to="/admin" className="btn btn-outline-secondary mb-3">
        &larr; Back to Admin Dashboard
      </Link>

      <Row className="mb-4 align-items-center">
        <Col>
          <h1>File Browser - {server?.name}</h1>
          <p className="text-muted mb-0">
            Container: {server?.containerName}
          </p>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage('')} dismissible>
          {successMessage}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Header>
          <Breadcrumb>
            {breadcrumbs.map((crumb, index) => (
              <Breadcrumb.Item 
                key={index}
                active={index === breadcrumbs.length - 1}
                onClick={() => handleBreadcrumbClick(crumb)}
                linkAs="button"
                className="text-decoration-none border-0 bg-transparent p-0"
              >
                {index === 0 ? (
                  <>
                    <FontAwesomeIcon icon={faHdd} /> {crumb.name}
                  </>
                ) : (
                  crumb.name
                )}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-3">Loading content...</p>
            </div>
          ) : inVolumesView ? (
            <>
              <h5 className="mb-3">Mounted Volumes</h5>
              {volumes.length === 0 ? (
                <div className="text-center p-4">
                  <p className="text-muted">No volumes mounted to this container.</p>
                </div>
              ) : (
                <ListGroup>
                  {volumes.map((volume, index) => (
                    <ListGroup.Item 
                      key={index}
                      action
                      onClick={() => handleVolumeClick(volume)}
                    >
                      <FontAwesomeIcon icon={faDatabase} className="me-2 text-primary" />
                      <strong>{volume.name}</strong>
                      <span className="text-muted ms-2">
                        ({volume.destination})
                      </span>
                      <small className="d-block text-muted">
                        {volume.type} - {volume.rw ? 'Read/Write' : 'Read Only'}
                      </small>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </>
          ) : (
            <>
              {files.length === 0 ? (
                <div className="text-center p-4">
                  <p className="text-muted">This directory is empty.</p>
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => handleBreadcrumbClick(breadcrumbs[0])}
                  >
                    Back to Volumes
                  </Button>
                </div>
              ) : (
                <ListGroup>
                  {currentPath !== selectedVolume?.destination && (
                    <ListGroup.Item 
                      action 
                      onClick={() => {
                        const pathParts = currentPath.split('/');
                        pathParts.pop();
                        const parentPath = pathParts.join('/') || selectedVolume.destination;
                        fetchDirectoryContents(parentPath);
                      }}
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
                      ../ (Parent Directory)
                    </ListGroup.Item>
                  )}
                  {files.map((file, index) => (
                    <ListGroup.Item 
                      key={index}
                      action
                      onClick={() => handleFileClick(file)}
                    >
                      {getFileIcon(file)}
                      {file.name}
                      {!file.isDirectory && (
                        <small className="text-muted ms-2">({file.size} bytes)</small>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* File Editor Modal */}
      <Modal 
        show={showEditor} 
        onHide={closeEditor}
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {currentFile?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AceEditor
            mode={editorMode}
            theme={editorTheme}
            onChange={setFileContent}
            value={fileContent}
            name="file-editor"
            editorProps={{ $blockScrolling: true }}
            setOptions={{
              useWorker: false,
              showLineNumbers: true,
              tabSize: 2,
              fontSize: 14,
              fontFamily: "monospace",
              highlightActiveLine: true,
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              enableSnippets: true,
              showPrintMargin: false,
            }}
            style={{ width: '100%', height: '500px', marginBottom: '1rem' }}
          />
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex justify-content-between w-100">
            <div>
              <select 
                className="form-select me-2"
                value={editorTheme}
                onChange={(e) => setEditorTheme(e.target.value)}
                style={{ display: 'inline-block', width: 'auto' }}
              >
                <option value="monokai">Theme: Dark</option>
                <option value="github">Theme: Light</option>
              </select>
            </div>
            <div>
              <Button variant="secondary" onClick={closeEditor} className="me-2">
                Close
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSaveFile}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default FileBrowser;