import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TicketDetail from '../TicketDetail';
import CreateTicketModal from '../CreateTicketModal';

const mockTicket = {
  ticket_id: 'TCK-1',
  summary: 'Example ticket',
  description: 'details',
  status: 'open',
  created_by: { first_name: 'John', last_name: 'Doe' },
  created_at: new Date().toISOString(),
  predicted_cti: {
    bu_number: '123',
    category: 'Hardware',
    type: 'Laptop',
    item: 'Battery',
    resolver_group: 'IT Support',
    request_type: 'Incident',
    sla: 'P3',
  },
  final_cti: {
    category: 'Hardware',
    resolver_group: 'IT Support',
    sla: 'P3'
  }
};

describe('End User AI Visibility', () => {
  test('end user does not see AI prediction section', () => {
    const endUser = { role: 'end_user' };
    render(<TicketDetail ticket={mockTicket} isOpen={true} userRole={endUser.role} onClose={() => {}} onUpdate={() => {}} />);
    expect(screen.queryByText(/AI Prediction/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI Reasoning/i)).not.toBeInTheDocument();
  });

  test('end user sees simplified assignment info', () => {
    const endUser = { role: 'end_user' };
    render(<TicketDetail ticket={mockTicket} isOpen={true} userRole={endUser.role} onClose={() => {}} onUpdate={() => {}} />);
    expect(screen.getByText('Ticket Assignment')).toBeInTheDocument();
    expect(screen.getByText(/Support Team/)).toBeInTheDocument();
    expect(screen.getByText(/Priority/)).toBeInTheDocument();
  });

  test('create ticket modal does not mention AI', () => {
    render(<CreateTicketModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.queryByText(/AI Prediction/i)).not.toBeInTheDocument();
    expect(screen.getByText(/automatically routed/i)).toBeInTheDocument();
  });
});
