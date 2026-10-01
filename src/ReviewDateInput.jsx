import React from 'react';
import './review-date.css';

const months=['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ReviewDateInput({value,onChange}) {
  const today=new Date();
  const [year='',month='',day='']=String(value||'').slice(0,10).split('-');
  const partial=Boolean(year||month||day);
  const maxDays=month?new Date(Number(year)||2000,Number(month),0).getDate():31;
  const years=Array.from({length:today.getFullYear()-1900+1},(_,i)=>String(today.getFullYear()-i));
  const update=(part,next)=>{
    const parts={year,month,day,[part]:next};
    if(parts.month&&parts.day){
      const limit=new Date(Number(parts.year)||2000,Number(parts.month),0).getDate();
      if(Number(parts.day)>limit)parts.day='';
    }
    if(parts.year===String(today.getFullYear())){
      if(Number(parts.month)>today.getMonth()+1){parts.month='';parts.day='';}
      if(Number(parts.month)===today.getMonth()+1&&Number(parts.day)>today.getDate())parts.day='';
    }
    onChange(parts.year||parts.month||parts.day?`${parts.year}-${parts.month}-${parts.day}`:'');
  };
  return <fieldset className="review-date-field"><legend>Travel date <small>(optional)</small></legend><div className="review-date-selects">
    <label>Day<select aria-label="Travel day" required={partial} value={day} onChange={e=>update('day',e.target.value)}><option value="">Day</option>{Array.from({length:maxDays},(_,i)=>i+1).map(n=><option key={n} value={String(n).padStart(2,'0')} disabled={year===String(today.getFullYear())&&Number(month)===today.getMonth()+1&&n>today.getDate()}>{n}</option>)}</select></label>
    <label>Month<select aria-label="Travel month" required={partial} value={month} onChange={e=>update('month',e.target.value)}><option value="">Month</option>{months.map((name,i)=><option key={name} value={String(i+1).padStart(2,'0')} disabled={year===String(today.getFullYear())&&i>today.getMonth()}>{name}</option>)}</select></label>
    <label>Year<select aria-label="Travel year" required={partial} value={year} onChange={e=>update('year',e.target.value)}><option value="">Year</option>{years.map(n=><option key={n}>{n}</option>)}</select></label>
  </div><small>Choose day, month and year, or leave the date blank.</small>{partial&&<button type="button" onClick={()=>onChange('')}>Clear date</button>}</fieldset>;
}
