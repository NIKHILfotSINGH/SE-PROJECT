import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getPatientMedicalProfile } from "../services/HospitalApi";
import { isPatientMedicalProfileComplete, PROFILE_COMPLETION_ALERT } from "../utils/patientMedicalProfile";

export default function PatientMedicalProfileGuard() {
  const location = useLocation();
  const [isChecking, setIsChecking] = React.useState(true);
  const [canAccess, setCanAccess] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const profile = await getPatientMedicalProfile();
        if (isMounted) {
          setCanAccess(isPatientMedicalProfileComplete(profile));
        }
      } catch (_) {
        if (isMounted) {
          setCanAccess(false);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isChecking) {
    return null;
  }

  if (!canAccess) {
    return <Navigate to="/patient/profile" replace state={{ profileAlert: PROFILE_COMPLETION_ALERT, from: location.pathname }} />;
  }

  return <Outlet />;
}