export default function PrimaryButton({children,secondary=false,...props}){
  return <button className={secondary?'btn secondary':'btn'} {...props}>{children}</button>
}
