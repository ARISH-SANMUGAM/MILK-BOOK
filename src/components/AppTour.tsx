import React from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useAppContext } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';

const AppTour: React.FC = () => {
  const { showTour, setShowTour, user } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = React.useState(0);

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to MilkBook! Let\'s set up your dairy business in 2 minutes.',
      placement: 'center',
    },
    {
      target: '#tour-business-name',
      content: 'Step 1: Enter your Business Name. This will be shown on all customer bills.',
      disableBeacon: true,
    },
    {
      target: '#tour-upi-id',
      content: 'Step 2: Add your UPI ID (e.g., yourname@okaxis). We will generate a QR code for your customers automatically!',
    },
    {
      target: '#tour-milk-rate',
      content: 'Step 3: Set your Milk Rate per Litre. Note: You can only change this on the 1st of each month!',
    },
    {
      target: '#tour-add-customer',
      content: 'Now, let\'s add your customers. Try adding at least 2 customers to see how the list management works! You can click "Add New" even while this tour is running.',
      spotlightClicks: true,
    },
    {
      target: '#tour-session-toggle',
      content: 'In the Delivery page, you can toggle between Morning and Evening milk distribution.',
    },
    {
      target: '#tour-delivery-card',
      content: 'Simply adjust the liters for each member. Your data is synced to the cloud instantly!',
    },
    {
      target: '#tour-report-summary',
      content: 'Finally, view your monthly collection summary and outstanding balances here.',
    },
    {
      target: '#tour-report-item',
      content: 'Click on a customer to view their detailed statement and record payments. Your tour is complete!',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, step, type, index, action } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setShowTour(false);
      if (user) {
         localStorage.setItem(`tour_seen_${user.uid}`, 'true');
      }
    }

    if (type === 'step:after') {
      const nextIndex = index + 1;
      setStepIndex(nextIndex);

      if (index === 0) {
        navigate('/settings');
      } else if (index === 3) {
        navigate('/customers');
      } else if (index === 4) {
        navigate('/delivery');
      } else if (index === 6) {
        navigate('/reports');
      }
    } else if (type === 'step:before' && action === 'prev') {
        const prevIndex = index - 1;
        setStepIndex(prevIndex);
        if (prevIndex === 0) navigate('/');
        if (prevIndex === 1) navigate('/settings');
        if (prevIndex === 4) navigate('/customers');
        if (prevIndex === 5) navigate('/delivery');
    }
  };

  return (
    <Joyride
      steps={steps}
      run={showTour}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      disableScrolling={false}
      styles={{
        options: {
          primaryColor: '#1e1b4b',
          zIndex: 1000,
        },
        buttonNext: {
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          padding: '12px 20px',
          borderRadius: '8px',
          backgroundColor: '#1e1b4b',
        },
        buttonBack: {
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          marginRight: '10px',
          color: '#64748b',
        },
        buttonSkip: {
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          color: '#94a3b8',
        },
        tooltip: {
          borderRadius: '16px',
          padding: '20px',
        },
        tooltipTitle: {
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#1e1b4b',
        },
        tooltipContent: {
          fontSize: '13px',
          color: '#64748b',
          padding: '10px 0',
        }
      }}
    />
  );
};

export default AppTour;
