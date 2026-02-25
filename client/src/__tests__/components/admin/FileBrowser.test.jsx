import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import FileBrowser from '../../../components/admin/FileBrowser';

jest.mock('axios');

const mockAceFind = jest.fn();
const mockAceFocus = jest.fn();

jest.mock('react-ace', () => {
  const React = require('react');

  return function MockAceEditor(props) {
    React.useEffect(() => {
      if (props.onLoad) {
        props.onLoad({
          find: mockAceFind,
          focus: mockAceFocus,
        });
      }
    }, [props.onLoad]);

    return (
      <textarea
        data-testid="ace-editor"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        style={props.style}
      />
    );
  };
});

const renderFileBrowser = () => {
  return render(
    <MemoryRouter initialEntries={['/admin/servers/1/files']}>
      <Routes>
        <Route path="/admin/servers/:id/files" element={<FileBrowser />} />
      </Routes>
    </MemoryRouter>
  );
};

const openEditor = async () => {
  renderFileBrowser();

  await waitFor(() => expect(screen.getByText('Data Volume')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Data Volume'));

  await waitFor(() => expect(screen.getByText('server.xml')).toBeInTheDocument());
  fireEvent.click(screen.getByText('server.xml'));

  await waitFor(() => expect(screen.getByLabelText(/Search In File/i)).toBeInTheDocument());
};

describe('FileBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    axios.get.mockImplementation((url, config) => {
      if (url === '/api/admin/servers/1') {
        return Promise.resolve({
          data: {
            name: 'Test Server',
            containerName: 'test-container',
          },
        });
      }

      if (url === '/api/admin/servers/1/volumes') {
        return Promise.resolve({
          data: {
            volumes: [
              {
                name: 'Data Volume',
                destination: '/data',
                type: 'bind',
                rw: true,
              },
            ],
          },
        });
      }

      if (url === '/api/admin/servers/1/files') {
        if (config?.params?.path === '/data') {
          return Promise.resolve({
            data: {
              path: '/data',
              files: [
                {
                  name: 'server.xml',
                  path: '/data/server.xml',
                  isDirectory: false,
                  size: 120,
                },
              ],
            },
          });
        }

        return Promise.resolve({
          data: {
            path: config?.params?.path,
            files: [],
          },
        });
      }

      if (url === '/api/admin/servers/1/files/content') {
        return Promise.resolve({
          data: {
            content: '<root>Needle</root>',
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET request: ${url}`));
    });
  });

  it('allows changing editor height from the size control', async () => {
    await openEditor();

    const editor = screen.getByTestId('ace-editor');
    expect(editor).toHaveStyle({ height: '500px' });

    fireEvent.change(screen.getByLabelText(/Editor Height/i), { target: { value: '700' } });
    expect(screen.getByTestId('ace-editor')).toHaveStyle({ height: '700px' });

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('ace-editor')).toHaveStyle({ height: '500px' });
  });

  it('runs next and previous search actions in the editor', async () => {
    mockAceFind.mockReturnValue({ start: {}, end: {} });

    await openEditor();

    fireEvent.change(screen.getByLabelText(/Search In File/i), { target: { value: 'Needle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(mockAceFind).toHaveBeenCalledWith(
      'Needle',
      expect.objectContaining({
        backwards: false,
        wrap: true,
        caseSensitive: false,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    expect(mockAceFind).toHaveBeenLastCalledWith(
      'Needle',
      expect.objectContaining({
        backwards: true,
        wrap: true,
        caseSensitive: false,
      })
    );

    fireEvent.click(screen.getByLabelText(/Case sensitive/i));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(mockAceFind).toHaveBeenLastCalledWith(
      'Needle',
      expect.objectContaining({
        backwards: false,
        wrap: true,
        caseSensitive: true,
      })
    );
  });
});
