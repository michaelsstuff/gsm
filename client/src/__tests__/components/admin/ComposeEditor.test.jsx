import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComposeEditor from '../../../components/admin/ComposeEditor';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
jest.mock('axios');

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('ComposeEditor', () => {
  it('renders new compose editor and loads templates', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ id: '1', name: 'Test Template', content: 'version: "3"' }] });
    renderWithRouter(<ComposeEditor />);
    // Should show the template dropdown (not loading spinner)
    await waitFor(() => expect(screen.getByLabelText(/Start from Template/i)).toBeInTheDocument());
    // Wait for the template option to appear
    await waitFor(() => expect(screen.getByRole('option', { name: /Test Template/i })).toBeInTheDocument());
  });

  it('shows error on failed template fetch', async () => {
    axios.get.mockRejectedValueOnce(new Error('fail'));
    renderWithRouter(<ComposeEditor />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
  });
});
