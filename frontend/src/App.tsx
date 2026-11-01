import { Inicio } from './features/inicio'
import { Simulador } from './features/simulador'

export default function App() {
  const caminho = window.location.pathname.replace(/\/$/, '')
  return caminho === '/simulador' ? <Simulador /> : <Inicio />
}
