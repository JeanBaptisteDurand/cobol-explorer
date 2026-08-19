       IDENTIFICATION DIVISION.
       PROGRAM-ID. LGBATCH.
      ******************************************************************
      * DEMO batch program (NOT from GenApp). Illustrates SELECT/ASSIGN
      * -> DD -> DSN data lineage: this batch step reads the policy
      * master file, so lineage(INS.POLICY.MASTER) is demonstrable.
      * It also COPYs LGPOLICY, so it joins the copybook impact set.
      ******************************************************************
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT POLICY-FILE ASSIGN TO POLFILE
               ORGANIZATION IS SEQUENTIAL.
       DATA DIVISION.
       FILE SECTION.
       FD  POLICY-FILE.
       01  POLICY-REC              PIC X(80).
       WORKING-STORAGE SECTION.
           COPY LGPOLICY.
       01  WS-EOF                  PIC X VALUE 'N'.
       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT POLICY-FILE
           PERFORM READ-POLICY
           CLOSE POLICY-FILE
           GOBACK.
       READ-POLICY.
           READ POLICY-FILE
               AT END MOVE 'Y' TO WS-EOF
           END-READ.
