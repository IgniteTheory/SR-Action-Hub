import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Client, RequestType, UserSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { COMM_SOURCE_LABELS, PRIORITY_LABELS, TURNAROUND_LABELS } from '../utils/format';

interface Props {
  users: UserSummary[];
  requestTypes: RequestType[];
  onClose: () => void;
  onCreated: () => void;
  onRequestTypeCreated: (rt: RequestType) => void;
}

export default function CreateActionDrawer({ users, requestTypes, onClose, onCreated, onRequestTypeCreated }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRATOR';

  const [clients, setClients] = useState<Client[]>([]);
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [newClientName, setNewClientName] = useState('');

  const [contactPerson, setContactPerson] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [communicationSource, setCommunicationSource] = useState('PHONE');
  const [requestTypeId, setRequestTypeId] = useState<number | ''>('');
  const [otherRequestDetail, setOtherRequestDetail] = useState('');
  const [saveAsNewType, setSaveAsNewType] = useState(false);
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState<number | ''>('');
  const [priority, setPriority] = useState('NORMAL');
  const [turnaround, setTurnaround] = useState('TODAY');
  const [customHours, setCustomHours] = useState(24);
  const [sendAcknowledgement, setSendAcknowledgement] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      api.get<{ clients: Client[] }>(`/clients?search=${encodeURIComponent(clientQuery)}`).then((r) => setClients(r.clients));
    }, 200);
    return () => clearTimeout(handle);
  }, [clientQuery]);

  const selectedType = requestTypes.find((t) => t.id === requestTypeId);
  const isOther = selectedType?.name === 'Other';

  async function handleSubmit() {
    setError(null);
    if (!selectedClientId && !newClientName.trim()) {
      setError('Choose an existing client or enter a new client name.');
      return;
    }
    if (!contactPerson.trim()) {
      setError('Contact Person is required.');
      return;
    }
    if (!requestTypeId) {
      setError('Request Type is required.');
      return;
    }
    if (isOther && !otherRequestDetail.trim()) {
      setError('Please describe the request.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    setSubmitting(true);
    try {
      let finalRequestTypeId = requestTypeId as number;
      if (isOther && isAdmin && saveAsNewType && otherRequestDetail.trim()) {
        const res = await api.post<{ requestType: RequestType }>('/request-types', { name: otherRequestDetail.trim() });
        onRequestTypeCreated(res.requestType);
        finalRequestTypeId = res.requestType.id;
      }

      await api.post('/actions', {
        clientId: selectedClientId ?? undefined,
        newClientName: selectedClientId ? undefined : newClientName.trim(),
        contactPerson: contactPerson.trim(),
        telephone: telephone.trim() || undefined,
        email: email.trim() || undefined,
        communicationSource,
        requestTypeId: finalRequestTypeId,
        otherRequestDetail: isOther ? otherRequestDetail.trim() : undefined,
        description: description.trim(),
        assignedToId: assignedToId || null,
        priority,
        turnaround,
        customTurnaroundHours: turnaround === 'CUSTOM' ? customHours : undefined,
        sendAcknowledgement,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create action');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <h2>New Action</h2>

        <h3>Client</h3>
        <div className="field">
          <label>Search existing client</label>
          <input
            id="ca_client_search"
            value={clientQuery}
            onChange={(e) => {
              setClientQuery(e.target.value);
              setSelectedClientId(null);
            }}
            placeholder="Type to search…"
          />
          {clientQuery && clients.length > 0 && !selectedClientId && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 7, marginTop: 4 }}>
              {clients.map((c) => (
                <div
                  key={c.id}
                  style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => {
                    setSelectedClientId(c.id);
                    setClientQuery(c.name);
                  }}
                >
                  {c.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {!selectedClientId && (
          <div className="field">
            <label>Or new client name</label>
            <input id="ca_new_client" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="New client name" />
          </div>
        )}

        <h3>Request Details</h3>
        <div className="field">
          <label>Contact Person</label>
          <input id="ca_contact_person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Telephone</label>
            <input id="ca_telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input id="ca_email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Communication Source</label>
          <select id="ca_comm_source" value={communicationSource} onChange={(e) => setCommunicationSource(e.target.value)}>
            {Object.entries(COMM_SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Request Type</label>
          <select id="ca_request_type" value={requestTypeId} onChange={(e) => setRequestTypeId(Number(e.target.value))}>
            <option value="">Select…</option>
            {requestTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        {isOther && (
          <div className="field">
            <label>Describe Request</label>
            <input value={otherRequestDetail} onChange={(e) => setOtherRequestDetail(e.target.value)} />
            {isAdmin && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontWeight: 400 }}>
                <input type="checkbox" checked={saveAsNewType} onChange={(e) => setSaveAsNewType(e.target.checked)} />
                Save as new Request Type?
              </label>
            )}
          </div>
        )}
        <div className="field">
          <label>Description</label>
          <textarea id="ca_description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <h3>Assignment</h3>
        <div className="field-row">
          <div className="field">
            <label>Assigned To</label>
            <select id="ca_assigned_to" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Unallocated</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select id="ca_priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Turnaround Time</label>
          <select id="ca_turnaround" value={turnaround} onChange={(e) => setTurnaround(e.target.value)}>
            {Object.entries(TURNAROUND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {turnaround === 'CUSTOM' && (
          <div className="field">
            <label>Custom Turnaround (hours)</label>
            <input type="number" min={1} value={customHours} onChange={(e) => setCustomHours(Number(e.target.value))} />
          </div>
        )}

        <label className="checkbox-field">
          <input type="checkbox" checked={sendAcknowledgement} onChange={(e) => setSendAcknowledgement(e.target.checked)} />
          Send Client Acknowledgement
        </label>

        {error && <div className="error-text">{error}</div>}

        <div className="drawer-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Action'}
          </button>
        </div>
      </div>
    </div>
  );
}
