import { useAsistente } from '../context/AsistenteContext';

const STEPS = [
  { id: 1, label: 'Inicio (Token)' },
  { id: 2, label: 'Direccionamiento' },
  { id: 3, label: 'Programación' },
  { id: 4, label: 'Entrega' },
  { id: 5, label: 'Reporte Final' },
];

export const Stepper = () => {
  const { currentStep } = useAsistente();

  return (
    <div className="stepper">
      {STEPS.map((step) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;

        let stepClass = 'step';
        if (isActive) stepClass += ' active';
        if (isCompleted) stepClass += ' completed';

        return (
          <div key={step.id} className={stepClass}>
            <div className="step-number">
              {isCompleted ? '✓' : step.id}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
};
