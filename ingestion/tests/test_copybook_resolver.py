"""Copybook resolver: SYSLIB concatenation, nested COPY, COPY REPLACING."""
from parsers.copybook_resolver import CopybookResolver


def _write(d, name, text):
    (d / name).write_text(text)


def test_syslib_concatenation_first_match(tmp_path):
    lib1 = tmp_path / "lib1"; lib2 = tmp_path / "lib2"
    lib1.mkdir(); lib2.mkdir()
    _write(lib2, "SHARED.cpy", "       05 FROM-LIB2 PIC X.\n")
    _write(lib1, "SHARED.cpy", "       05 FROM-LIB1 PIC X.\n")
    r = CopybookResolver([str(lib1), str(lib2)])  # lib1 first
    assert "FROM-LIB1" in r.resolve("SHARED")
    assert "FROM-LIB2" not in r.resolve("SHARED")


def test_nested_copy_expansion(tmp_path):
    lib = tmp_path / "lib"; lib.mkdir()
    _write(lib, "CHILD.cpy", "       05 WS-A PIC X.\n       05 WS-B PIC X.\n")
    _write(lib, "PARENT.cpy", "       01 REC.\n           COPY CHILD.\n")
    r = CopybookResolver([str(lib)])
    out = r.resolve("PARENT")
    assert "WS-A" in out and "WS-B" in out and "REC" in out
    assert r.dependencies("PARENT") == {"CHILD"}


def test_copy_replacing_pseudo_text(tmp_path):
    lib = tmp_path / "lib"; lib.mkdir()
    _write(lib, "TPL.cpy", "       01 :PFX:-REC.\n         05 :PFX:-FIELD PIC X.\n")
    r = CopybookResolver([str(lib)])
    out = r.resolve("TPL", replacing=[(":PFX:", "WS")])
    assert "WS-REC" in out and "WS-FIELD" in out and ":PFX:" not in out


def test_cycle_safe(tmp_path):
    lib = tmp_path / "lib"; lib.mkdir()
    _write(lib, "A.cpy", "       COPY B.\n")
    _write(lib, "B.cpy", "       COPY A.\n")
    r = CopybookResolver([str(lib)])
    assert "cycle" in r.resolve("A").lower()  # terminates, flags the cycle
