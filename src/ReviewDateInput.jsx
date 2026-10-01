import React,{useRef} from 'react';
import {CalendarDays} from 'lucide-react';
import './review-date.css';

export default function ReviewDateInput({value,onChange}) {
  const input=useRef(null);
  const today=new Date();
  const maximum=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const openCalendar=()=>{
    try {
      if(input.current?.showPicker)input.current.showPicker();
      else input.current?.focus();
    } catch {
      input.current?.focus();
    }
  };
  return <fieldset className="review-date-field"><legend>Travel date <small>(optional)</small></legend>
    <div className="review-date-calendar">
      <input ref={input} type="date" aria-label="Travel date" value={String(value||'').slice(0,10)} max={maximum} onChange={e=>onChange(e.target.value)}/>
      <button type="button" onClick={openCalendar} aria-label="Open travel date calendar"><CalendarDays/> Choose date</button>
    </div>
    <small>Select your travel date from the calendar, or leave it blank.</small>
    {value&&<button type="button" onClick={()=>onChange('')}>Clear date</button>}
  </fieldset>;
}
