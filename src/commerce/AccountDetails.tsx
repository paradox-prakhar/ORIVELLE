import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowUpRight, Check } from 'lucide-react';
import { api, errorMessage, post } from './api';
import { useCommerce } from './context';
import { ErrorNotice } from './shared';

export function AccountDetails() {
  const { user, refreshUser, config } = useCommerce();
  const { register, handleSubmit, formState: { errors } } = useForm<{name: string}>({defaultValues: {name: user?.name || ''}});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  return <section className="c-profile"><span className="c-eyebrow">A LITTLE MORE ABOUT YOU</span><h2>Your details.</h2><form onSubmit={handleSubmit(async ({name}) => {setBusy(true);setError('');setSaved(false);try{await api('/account',{method:'PATCH',body:JSON.stringify({name:name.trim()})});await refreshUser();setSaved(true);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}})}><label className="c-field">Your name<input {...register('name',{required:'Enter your name.',minLength:{value:2,message:'Use at least two characters.'},maxLength:{value:100,message:'Use at most 100 characters.'}})} autoComplete="name"/>{errors.name && <span className="c-field-error">{errors.name.message}</span>}</label><label className="c-field">Email address<input value={user?.email || ''} readOnly type="email"/><span className="c-muted">Email changes require a configured verification service.</span></label>{error && <ErrorNotice>{error}</ErrorNotice>}<button className="c-button" disabled={busy}>{busy ? 'Saving…' : saved ? 'Details saved' : 'Save my details'}{saved ? <Check size={17}/> : <ArrowUpRight size={17}/>}</button>{saved && <p className="c-success" role="status">Your profile has been updated.</p>}</form><p className="c-service-note">{config?.email.message || 'Email verification and password reset require a configured email provider.'}</p></section>;
}

export function ReturnRequest({ orderId }: {orderId: string}) {
  const [open,setOpen] = useState(false); const [reason,setReason] = useState('');
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false); const [saved,setSaved] = useState(false);
  if(saved) return <p className="c-success" role="status">Your return request is saved for review. This does not confirm a return approval or refund.</p>;
  return <div className="c-return-request">{!open ? <button className="c-text-link" onClick={() => setOpen(true)}>Request a return<ArrowUpRight size={15}/></button> : <form onSubmit={async (event) => {event.preventDefault();setError('');if(reason.trim().length < 10){setError('Tell us a little more, using at least 10 characters.');return;}setBusy(true);try{await api(`/orders/${orderId}/return`,post({reason:reason.trim()}));setSaved(true);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}><label className="c-field">What would you like us to know?<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1500} required rows={4}/></label><p className="c-order-note">Requests are accepted within 14 days of delivery and are reviewed by the store. Submitting a request does not process a refund.</p>{error && <ErrorNotice>{error}</ErrorNotice>}<div className="c-inline-actions"><button className="c-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit return request'}<ArrowUpRight size={16}/></button><button type="button" className="c-text-link" onClick={() => setOpen(false)}>Keep my order</button></div></form>}</div>;
}
